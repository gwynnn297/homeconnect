import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from openai import OpenAI

from .config import Settings
from .prompts import SYSTEM_PROMPT
from .schemas import ParseChatResponse


SERVICE_KEYWORDS = {
    1: ["dọn nhà", "don nha", "dọn dẹp", "don dep", "lau nhà", "lau nha", "vệ sinh nhà", "ve sinh nha"],
    2: ["nấu ăn", "nau an", "nấu cơm", "nau com", "đầu bếp", "dich vu nau", "nau toi", "nau bua toi"],
    3: ["đi chợ", "di cho", "mua hộ", "mua do", "mua đồ"],
    4: ["văn phòng", "van phong", "dọn văn phòng", "ve sinh van phong", "vệ sinh văn phòng", "ve sinh vp"],
    5: ["trông trẻ", "trong tre", "giữ trẻ", "giu tre", "chăm bé", "cham be", "trong be", "giu be"],
    6: ["làm vườn", "lam vuon", "cắt tỉa", "cat tia", "tưới cây", "tuoi cay"],
    7: ["sơn sửa", "son sua", "sửa nhà", "sua nha", "sơn tường", "son tuong"],
}

ADDRESS_HINTS = (" tại ", " o ", " ở ", " số ", " đường ", " quận ", " phường ", " huyện ", " tỉnh ", " thành phố ")


@dataclass
class ParsedDraft:
    categoryId: int | None = None
    durationHours: int | None = None
    workDate: str | None = None
    startTime: str | None = None
    addressText: str | None = None


class ChatParserService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def parse(self, message: str) -> ParseChatResponse:
        rule_result = self._parse_rule_based(message)
        if not self.client:
            return rule_result

        try:
            ai_result = self._parse_with_openai(message)
            return self._merge_results(rule_result, ai_result)
        except Exception:
            return rule_result

    def _parse_rule_based(self, message: str) -> ParseChatResponse:
        text = self._normalize_text(message)
        now = self._get_now()
        draft = ParsedDraft(
            categoryId=self._extract_category(text),
            durationHours=self._extract_duration_hours(text),
            workDate=self._extract_date(text, now),
            startTime=self._extract_start_time(text),
            addressText=self._extract_address_text(message),
        )
        return self._finalize_response(draft, source="rule_based")

    def _parse_with_openai(self, message: str) -> ParseChatResponse:
        today = self._get_now().strftime("%Y-%m-%d")
        response = self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Hôm nay là {today}. Hãy parse câu sau thành JSON schema của booking parser:\n"
                        f"{message}"
                    ),
                },
            ],
        )
        raw_text = getattr(response, "output_text", "") or ""
        if not raw_text:
            raise ValueError("Empty OpenAI response")
        payload = json.loads(raw_text)
        return ParseChatResponse(**payload, source="openai", raw=payload)

    def _merge_results(self, rule_result: ParseChatResponse, ai_result: ParseChatResponse) -> ParseChatResponse:
        merged = ParseChatResponse(
            categoryId=ai_result.categoryId or rule_result.categoryId,
            durationHours=ai_result.durationHours or rule_result.durationHours,
            workDate=ai_result.workDate or rule_result.workDate,
            startTime=ai_result.startTime or rule_result.startTime,
            serviceIds=ai_result.serviceIds or rule_result.serviceIds,
            addressText=ai_result.addressText or rule_result.addressText,
            needsAddressConfirmation=True,
            missingFields=[],
            followUpQuestion=None,
            confidence=max(ai_result.confidence, rule_result.confidence),
            source=ai_result.source,
            raw=ai_result.raw,
        )
        return self._with_missing_fields(merged)

    def _finalize_response(self, draft: ParsedDraft, source: str) -> ParseChatResponse:
        result = ParseChatResponse(
            categoryId=draft.categoryId,
            durationHours=draft.durationHours,
            workDate=draft.workDate,
            startTime=draft.startTime,
            serviceIds=[],
            addressText=draft.addressText,
            needsAddressConfirmation=True,
            confidence=self._estimate_confidence(draft),
            source=source,
            raw=asdict(draft),
        )
        return self._with_missing_fields(result)

    def _get_now(self) -> datetime:
        try:
            return datetime.now(ZoneInfo(self.settings.app_timezone))
        except (ZoneInfoNotFoundError, ModuleNotFoundError):
            return datetime.now()
        except Exception:
            return datetime.now()

    def _with_missing_fields(self, result: ParseChatResponse) -> ParseChatResponse:
        missing_fields: list[str] = []
        if result.categoryId is None:
            missing_fields.append("categoryId")
        if result.durationHours is None:
            missing_fields.append("durationHours")
        if result.workDate is None:
            missing_fields.append("workDate")
        if result.startTime is None:
            missing_fields.append("startTime")

        result.missingFields = missing_fields
        if not missing_fields:
            result.followUpQuestion = None
            return result

        friendly_names = {
            "categoryId": "dịch vụ",
            "durationHours": "số giờ",
            "workDate": "ngày làm",
            "startTime": "giờ bắt đầu",
        }
        missing_text = ", ".join(friendly_names[field] for field in missing_fields)
        result.followUpQuestion = f"Mình còn thiếu {missing_text}. Bạn bổ sung giúp mình nhé?"
        return result

    def _extract_category(self, text: str) -> int | None:
        for category_id, keywords in SERVICE_KEYWORDS.items():
            if any(keyword in text for keyword in keywords):
                return category_id
        return None

    def _extract_duration_hours(self, text: str) -> int | None:
        range_match = re.search(
            r"\b(?:từ|tu)\s*(\d{1,2})\s*(?:[:h\.](\d{2}))?\s*(?:đến|den)\s*(\d{1,2})\s*(?:[:h\.](\d{2}))?\b",
            text,
        )
        if range_match:
            start_hour = int(range_match.group(1))
            start_minute = int(range_match.group(2) or 0)
            end_hour = int(range_match.group(3))
            end_minute = int(range_match.group(4) or 0)
            start_total = start_hour * 60 + start_minute
            end_total = end_hour * 60 + end_minute
            if end_total > start_total:
                duration = (end_total - start_total) / 60
                return max(1, min(12, int(round(duration))))

        match = re.search(r"(\d+)\s*(tiếng|tieng|gio|giờ)\b", text)
        if not match:
            match = re.search(r"\btrong\s+(\d+)\s*h\b", text)
        if not match:
            match = re.search(r"\blàm\s+(\d+)\s*h\b", text)
        if not match:
            return None
        return max(1, min(12, int(match.group(1))))

    def _extract_date(self, text: str, now: datetime) -> str | None:
        has_next_week = any(
            phrase in text
            for phrase in (
                "tuần sau",
                "tuan sau",
                "tuần tới",
                "tuan toi",
                "tuần kế",
                "tuan ke",
                "tuần kế tiếp",
                "tuan ke tiep",
            )
        )
        has_this_week = any(phrase in text for phrase in ("tuần này", "tuan nay"))
        has_week_after_next = any(
            phrase in text for phrase in ("tuần sau nữa", "tuan sau nua", "2 tuần nữa", "2 tuan nua")
        )

        iso_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
        if iso_match:
            return iso_match.group(1)

        # Ví dụ: "vào 14h ngày 17" => lấy tháng/năm hiện tại (hoặc tháng tiếp theo nếu đã qua)
        # Chấp nhận: "ngày 17", "ngay 17", "ngày 17/04", "ngày 17 tháng 4"
        day_month_slash = re.search(r"\b(?:ngày|ngay)\s*(\d{1,2})\s*[/\-]\s*(\d{1,2})\b", text)
        if day_month_slash:
            day = int(day_month_slash.group(1))
            month = int(day_month_slash.group(2))
            try:
                dt = datetime(year=now.year, month=month, day=day, hour=12, minute=0, second=0)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                return None

        day_month_text = re.search(
            r"\b(?:ngày|ngay)\s*(\d{1,2})\s*(?:tháng|thang)\s*(\d{1,2})\b",
            text,
        )
        if day_month_text:
            day = int(day_month_text.group(1))
            month = int(day_month_text.group(2))
            try:
                dt = datetime(year=now.year, month=month, day=day, hour=12, minute=0, second=0)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                return None

        day_only = re.search(r"\b(?:ngày|ngay)\s*(\d{1,2})\b", text)
        if day_only:
            day = int(day_only.group(1))
            if 1 <= day <= 31:
                # Nếu ngày đã qua trong tháng hiện tại => dùng tháng tiếp theo
                target_year = now.year
                target_month = now.month
                if day < now.day:
                    target_month += 1
                    if target_month == 13:
                        target_month = 1
                        target_year += 1
                try:
                    dt = datetime(year=target_year, month=target_month, day=day, hour=12, minute=0, second=0)
                    return dt.strftime("%Y-%m-%d")
                except Exception:
                    return None

        if "ngày kia" in text or "ngay kia" in text:
            return (now + timedelta(days=2)).strftime("%Y-%m-%d")

        if "cuối tháng" in text or "cuoi thang" in text:
            next_month = now.month + 1
            year = now.year
            if next_month == 13:
                next_month = 1
                year += 1
            first_next_month = datetime(year=year, month=next_month, day=1, hour=12, minute=0, second=0)
            last_this_month = first_next_month - timedelta(days=1)
            return last_this_month.strftime("%Y-%m-%d")

        if "đầu tuần sau" in text or "dau tuan sau" in text:
            days_until_next_monday = (7 - now.weekday()) % 7
            if days_until_next_monday == 0:
                days_until_next_monday = 7
            return (now + timedelta(days=days_until_next_monday)).strftime("%Y-%m-%d")

        if "đầu tuần này" in text or "dau tuan nay" in text:
            days_until_monday = (0 - now.weekday()) % 7
            return (now + timedelta(days=days_until_monday)).strftime("%Y-%m-%d")

        if "giữa tuần sau" in text or "giua tuan sau" in text:
            days_until_next_wed = (9 - now.weekday()) % 7
            if days_until_next_wed == 0:
                days_until_next_wed = 7
            return (now + timedelta(days=days_until_next_wed)).strftime("%Y-%m-%d")

        if "giữa tuần này" in text or "giua tuan nay" in text:
            days_until_wed = (2 - now.weekday()) % 7
            return (now + timedelta(days=days_until_wed)).strftime("%Y-%m-%d")

        if "cuối tuần sau" in text or "cuoi tuan sau" in text:
            days_until_sat = (5 - now.weekday()) % 7
            if days_until_sat == 0:
                days_until_sat = 7
            return (now + timedelta(days=days_until_sat + 7)).strftime("%Y-%m-%d")

        if "cuối tuần này" in text or "cuoi tuan nay" in text:
            days_until_sat = (5 - now.weekday()) % 7
            return (now + timedelta(days=days_until_sat)).strftime("%Y-%m-%d")

        if "cuối tuần" in text or "cuoi tuan" in text:
            days_until_sat = (5 - now.weekday()) % 7
            if days_until_sat == 0:
                days_until_sat = 7
            return (now + timedelta(days=days_until_sat)).strftime("%Y-%m-%d")

        if "ngày mai" in text or "mai" in text:
            return (now + timedelta(days=1)).strftime("%Y-%m-%d")
        if "hôm nay" in text or "hom nay" in text:
            return now.strftime("%Y-%m-%d")

        weekday_map = {
            "thứ 2": 0,
            "thu 2": 0,
            "thứ 3": 1,
            "thu 3": 1,
            "thứ 4": 2,
            "thu 4": 2,
            "thứ 5": 3,
            "thu 5": 3,
            "thứ 6": 4,
            "thu 6": 4,
            "thứ 7": 5,
            "thu 7": 5,
            "chủ nhật": 6,
            "chu nhat": 6,
        }
        for label, weekday in weekday_map.items():
            if label in text:
                days_ahead = (weekday - now.weekday()) % 7
                if has_week_after_next:
                    days_ahead += 14
                elif has_next_week:
                    days_ahead += 7
                elif has_this_week:
                    days_ahead = days_ahead
                elif days_ahead == 0:
                    days_ahead = 7
                return (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
        return None

    def _extract_start_time(self, text: str) -> str | None:
        after_hour = re.search(r"\b(?:sau)\s*(\d{1,2})\s*h\b", text)
        if after_hour:
            hour = int(after_hour.group(1))
            if 0 <= hour <= 22:
                return f"{hour + 1:02d}:00"

        exact_hhmm = re.search(r"\b(\d{1,2})[:h\.](\d{2})\b", text)
        if exact_hhmm:
            hour = int(exact_hhmm.group(1))
            minute = int(exact_hhmm.group(2))
            if 0 <= hour <= 23 and minute in (0, 30):
                return f"{hour:02d}:{minute:02d}"

        # Ví dụ: "vào 14h", "14h ngày 17"
        in_hour = re.search(r"\b(?:vào|vao)\s*(\d{1,2})\s*h\b", text)
        if in_hour:
            hour = int(in_hour.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:00"

        bare_hour = re.search(r"\b(\d{1,2})\s*h\b", text)
        if bare_hour:
            hour = int(bare_hour.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:00"

        exact_hour = re.search(r"\b(lúc|luc|khoảng|khoang)\s+(\d{1,2})h?\b", text)
        if exact_hour:
            hour = int(exact_hour.group(2))
            if 0 <= hour <= 23:
                return f"{hour:02d}:00"

        if "đầu giờ chiều" in text or "dau gio chieu" in text:
            return "13:00"
        if "đầu giờ sáng" in text or "dau gio sang" in text:
            return "08:00"
        if "tối nay" in text or "toi nay" in text:
            return "18:00"

        if "sáng" in text or "sang" in text:
            return "08:00"
        if "trưa" in text or "trua" in text:
            return "11:00"
        if "chiều" in text or "chieu" in text:
            return "14:00"
        if "tối" in text or "toi" in text:
            return "18:00"
        return None

    def _extract_address_text(self, message: str) -> str | None:
        lowered = self._normalize_text(message)
        if not any(hint in lowered for hint in ADDRESS_HINTS):
            return None
        return message.strip()

    def _estimate_confidence(self, draft: ParsedDraft) -> float:
        score = 0.2
        if draft.categoryId is not None:
            score += 0.25
        if draft.durationHours is not None:
            score += 0.2
        if draft.workDate is not None:
            score += 0.2
        if draft.startTime is not None:
            score += 0.1
        if draft.addressText:
            score += 0.05
        return round(min(score, 0.99), 2)

    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(text.lower().strip().split())
