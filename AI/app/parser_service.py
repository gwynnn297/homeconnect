import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from openai import OpenAI

from .config import Settings
from .prompts import SYSTEM_PROMPT
from .schemas import ParseChatResponse


SERVICE_KEYWORDS = {
    1: [
        "don nha",
        "don dep",
        "lau nha",
        "ve sinh nha",
        "tap vu",
        "giup viec",
        "lau chui",
        "quet don",
        "don phong",
        "tong ve sinh",
        "lau kinh",
        "giat rem",
        "lau nha tam",
        "don can",
        "don can ho",
        "don phong ngu",
        "cleaning",
        "clean",
    ],
    2: [
        "nau an",
        "nau com",
        "dau bep",
        "dich vu nau",
        "nau toi",
        "nau bua toi",
        "nau bua",
        "chuan bi bua",
        "nau ho",
        "nau co",
        "nau tiec nho",
        "soan bua",
        "nau com gia dinh",
        "bua gia dinh",
        "cook",
        "cooking",
    ],
    3: ["di cho", "mua ho", "mua do"],
    4: ["van phong", "don van phong", "ve sinh van phong", "ve sinh vp"],
    5: [
        "trong tre",
        "giu tre",
        "cham be",
        "trong be",
        "giu be",
        "trong em be",
        "giu em",
        "cham em be",
        "trong con",
        "giu con",
        "trong be so sinh",
        "be 2 tuoi",
        "babysitter",
        "baby sitter",
    ],
    6: ["lam vuon", "cat tia", "tuoi cay"],
    7: ["son sua", "sua nha", "son tuong"],
}

ADDRESS_HINTS = (" tai ", " o ", " so ", " duong ", " quan ", " phuong ", " huyen ", " tinh ", " thanh pho ")
ADDRESS_SHORTCUT_HINTS = (" q1", " q2", " q3", " q4", " q5", " q6", " q7", " q8", " q9", " q10", " q11", " q12", " q.", " p", " tp hcm", " tphcm", " hcm", " sg", " hn")
INVALID_REQUEST_MESSAGE = "Yêu cầu không đúng, vui lòng nhập lại yêu cầu."
BOOKING_HINT_KEYWORDS = (
    "dat",
    "book",
    "booking",
    "slot",
    "need",
    "giup",
    "can",
    "dk lich",
    "dat keo",
    "dat slot",
    "dat lich ho",
    "chot lich",
    "giu slot",
    "check lich",
    "xin lich",
    "sap lich",
    "doi lich",
    "doi qua",
    "doi sang",
    "doi qua chieu",
    "doi qua toi",
    "doi qua sang",
    "doi gio",
    "doi ngay",
    "doi lich giup",
    "doi lich dum",
    "doi lich dum em",
    "doi lich dum minh",
    "doi lich dum toi",
    "doi lich giup minh",
    "doi lich giup toi",
    "doi sang",
    "doi qua",
    "dich sang",
    "doi lai",
    "dieu chinh",
    "thoi",
    "de",
    "a thoi",
    "a de",
    "xep lich",
    "len lich",
    "can nguoi",
    "kiem nguoi",
    "thue",
    "tim",
    "hen",
    "lich",
    "hom nay",
    "ngay mai",
    "ngay kia",
    "ngay mot",
    "mai mot",
    "tuan",
    "thu ",
    "t2",
    "t3",
    "t4",
    "t5",
    "t6",
    "t7",
    "cn",
    "chunhat",
    "thu2",
    "thu3",
    "thu4",
    "thu5",
    "thu6",
    "thu7",
    "t.2",
    "t.3",
    "t.4",
    "t.5",
    "t.6",
    "t.7",
    "c.n",
    "cnhat",
    "chieu",
    "xe chieu",
    "sang",
    "toi",
    "truoc",
    "sau",
    "gio",
    "g",
    "p",
    "tieng",
    "ruoi",
)
TYPO_REPLACEMENTS = (
    ("dăt", "dat"),
    ("donj", "don"),
    ("trongr", "trong"),
    ("nauw", "nau"),
    ("chunhat", "chu nhat"),
    ("ddon", "don"),
    ("donn", "don"),
    ("trogn", "trong"),
    ("chieefu", "chieu"),
    ("sangs", "sang"),
    ("vs", "voi"),
    ("ko", "khong"),
    ("k", "khong"),
    ("kg", "khong"),
    ("hok", "khong"),
    ("hông", "khong"),
    ("đg", "dang"),
)


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
        normalized_message = self._normalize_text(message)
        invalid_minute_token = self._extract_invalid_minute_token(normalized_message)
        invalid_duration_token = self._extract_invalid_duration_token(normalized_message)

        rule_result = self._parse_rule_based(message)
        rule_result = self._apply_explicit_update_field_guard(rule_result, normalized_message)
        rule_result = self._apply_duration_granularity_guard(rule_result, invalid_duration_token)
        rule_result = self._apply_minute_granularity_guard(rule_result, invalid_minute_token)
        if not self.client:
            return self._apply_invalid_request_fallback(message, rule_result)

        try:
            ai_result = self._parse_with_openai(message)
            merged = self._merge_results(rule_result, ai_result)
            merged = self._apply_explicit_update_field_guard(merged, normalized_message)
            merged = self._apply_duration_granularity_guard(merged, invalid_duration_token)
            merged = self._apply_minute_granularity_guard(merged, invalid_minute_token)
            return self._apply_invalid_request_fallback(message, merged)
        except Exception:
            return self._apply_invalid_request_fallback(message, rule_result)

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
        # Ưu tiên keyword không bị phủ định gần kề; nếu câu đổi ý nhiều lần thì lấy lần xuất hiện sau cùng.
        best_match: tuple[int, int] | None = None
        for category_id, keywords in SERVICE_KEYWORDS.items():
            for keyword in keywords:
                for match in re.finditer(re.escape(keyword), text):
                    idx = match.start()
                    if self._is_negated_keyword(text, idx, len(keyword)):
                        continue
                    if best_match is None or idx > best_match[1]:
                        best_match = (category_id, idx)
        return best_match[0] if best_match else None

    def _extract_duration_hours(self, text: str) -> int | None:
        if "nua buoi" in text:
            return 4
        if "nua tieng" in text:
            return 1

        decimal_hours = re.search(r"\b(\d{1,2})[\.,](\d)\s*(?:tieng|gio|h)\b", text)
        if decimal_hours:
            whole = int(decimal_hours.group(1))
            decimal = int(decimal_hours.group(2))
            duration = whole + (decimal / 10.0)
            return max(1, min(12, int(round(duration))))

        half_hours = re.search(r"\b(\d{1,2})\s*(?:tieng|gio|h)\s*ruoi\b", text)
        if half_hours:
            duration = int(half_hours.group(1)) + 0.5
            return max(1, min(12, int(round(duration))))

        # Chỉ coi là duration khi user viết rõ "tiếng/giờ + phút" (vd: "1 tieng 30"),
        # tránh bắt nhầm định dạng giờ bắt đầu như "6h45".
        mixed_hours = re.search(r"\b(\d{1,2})\s*(?:tieng|gio)\s+(\d{1,2})\b", text)
        if mixed_hours:
            whole = int(mixed_hours.group(1))
            minutes = int(mixed_hours.group(2))
            if minutes not in (0, 30):
                return None
            duration = whole + (minutes / 60.0)
            return max(1, min(12, int(round(duration))))

        minute_only = re.search(r"\b(\d{2,3})\s*p\b", text)
        if minute_only:
            duration = int(minute_only.group(1)) / 60.0
            return max(1, min(12, int(round(duration))))

        range_match = re.search(
            r"\b(?:từ|tu)\s*(\d{1,2})\s*(?:[:h\.](\d{2}))?\s*(?:đến|den)\s*(\d{1,2})\s*(?:[:h\.](\d{2}))?\b",
            text,
        )
        if range_match:
            start_hour = int(range_match.group(1))
            start_minute = int(range_match.group(2) or 0)
            end_hour = int(range_match.group(3))
            end_minute = int(range_match.group(4) or 0)
            if "chieu" in text or "toi" in text:
                if start_hour < 12:
                    start_hour += 12
                if end_hour < 12:
                    end_hour += 12
            start_total = start_hour * 60 + start_minute
            end_total = end_hour * 60 + end_minute
            if end_total > start_total:
                duration = (end_total - start_total) / 60
                return max(1, min(12, int(round(duration))))

        dash_range_match = re.search(
            r"\b(\d{1,2})\s*(?:[:h\.](\d{2}))?\s*-\s*(\d{1,2})\s*(?:[:h\.](\d{2}))?\s*(?:h)?\b",
            text,
        )
        if dash_range_match:
            start_hour = int(dash_range_match.group(1))
            start_minute = int(dash_range_match.group(2) or 0)
            end_hour = int(dash_range_match.group(3))
            end_minute = int(dash_range_match.group(4) or 0)
            start_total = start_hour * 60 + start_minute
            end_total = end_hour * 60 + end_minute
            if end_total > start_total:
                duration = (end_total - start_total) / 60
                return max(1, min(12, int(round(duration))))

        # Tránh bắt nhầm giờ bắt đầu dạng "6 gio kem 20", "6 gio hon 10" thành duration.
        match = re.search(r"\b(\d+)\s*(tiếng|tieng|gio|giờ)\b(?!\s*(kem|hon)\b)", text)
        if not match:
            match = re.search(r"\btrong\s+(\d+)\s*h\b", text)
        if not match:
            match = re.search(r"\blàm\s+(\d+)\s*h\b", text)
        if not match:
            return None
        unit = match.group(2) if len(match.groups()) >= 2 else ""
        if unit in ("gio", "giờ") and "gio bat dau" in text:
            return None
        return max(1, min(12, int(match.group(1))))

    def _extract_date(self, text: str, now: datetime) -> str | None:
        edit_date_phrase = any(
            token in text
            for token in (
                "ngay lam",
                "doi ngay",
                "sua ngay",
                "chuyen ngay",
                "day sang ngay",
                "dời ngày",
                "doi lich",
            )
        )

        relative_day_match = re.search(r"\b(\d{1,2})\s*ngay\s*nua\b", text)
        if relative_day_match:
            days = int(relative_day_match.group(1))
            if 1 <= days <= 31:
                return (now + timedelta(days=days)).strftime("%Y-%m-%d")

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
                "tuan toi nua",
                "tuần tới nữa",
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
        if not day_month_slash:
            # Hỗ trợ "26/4" khi user sửa ngày làm mà không gõ từ "ngày".
            day_month_slash = re.search(r"\b(\d{1,2})\s*[/\-]\s*(\d{1,2})\b", text)
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
        if not day_only and edit_date_phrase:
            # "sửa ngày làm thành 26" -> hiểu là ngày 26 tháng hiện tại (hoặc tháng sau nếu đã qua).
            bare_day_match = re.search(r"\b(?:thanh|la|qua|sang)\s*(\d{1,2})\b", text)
            if bare_day_match:
                day_only = bare_day_match
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

        if "hom qua" in text or "hôm qua" in text:
            return None
        if "hom kia" in text or "hôm kia" in text:
            return None

        if "ngay kia nua" in text or "ngày kia nữa" in text:
            return (now + timedelta(days=3)).strftime("%Y-%m-%d")
        if "mai mot" in text:
            return (now + timedelta(days=2)).strftime("%Y-%m-%d")
        if "ngay mot" in text or "ngày mốt" in text:
            return (now + timedelta(days=2)).strftime("%Y-%m-%d")
        if "ngày kia" in text or "ngay kia" in text:
            return (now + timedelta(days=2)).strftime("%Y-%m-%d")

        if "cuoi thang sau" in text or "cuối tháng sau" in text:
            month_after_next = now.month + 2
            year = now.year
            if month_after_next > 12:
                month_after_next -= 12
                year += 1
            if month_after_next == 12:
                next_month = 1
                next_year = year + 1
            else:
                next_month = month_after_next + 1
                next_year = year
            first_after_next_month = datetime(year=next_year, month=next_month, day=1, hour=12, minute=0, second=0)
            last_target_month = first_after_next_month - timedelta(days=1)
            return last_target_month.strftime("%Y-%m-%d")
        if "cuối tháng" in text or "cuoi thang" in text:
            next_month = now.month + 1
            year = now.year
        if "dau thang sau" in text or "đầu tháng sau" in text:
            target_month = now.month + 1
            target_year = now.year
            if target_month == 13:
                target_month = 1
                target_year += 1
            return datetime(year=target_year, month=target_month, day=1, hour=12, minute=0, second=0).strftime(
                "%Y-%m-%d"
            )
        if "giua thang" in text or "giữa tháng" in text:
            return datetime(year=now.year, month=now.month, day=15, hour=12, minute=0, second=0).strftime("%Y-%m-%d")

        mung_day = re.search(r"\bmung\s*(\d{1,2})\b", text)
        if mung_day:
            day = int(mung_day.group(1))
            if 1 <= day <= 31:
                target_year = now.year
                target_month = now.month
                if day < now.day:
                    target_month += 1
                    if target_month == 13:
                        target_month = 1
                        target_year += 1
                try:
                    return datetime(
                        year=target_year,
                        month=target_month,
                        day=day,
                        hour=12,
                        minute=0,
                        second=0,
                    ).strftime("%Y-%m-%d")
                except Exception:
                    return None

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
        if "cuoi tuan toi nua" in text or "cuối tuần tới nữa" in text:
            days_until_sat = (5 - now.weekday()) % 7
            if days_until_sat == 0:
                days_until_sat = 7
            return (now + timedelta(days=days_until_sat + 14)).strftime("%Y-%m-%d")

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
            "thu2": 0,
            "thu3": 1,
            "thu4": 2,
            "thu5": 3,
            "thu6": 4,
            "thu7": 5,
            "t.2": 0,
            "t.3": 1,
            "t.4": 2,
            "t.5": 3,
            "t.6": 4,
            "t.7": 5,
            "t2": 0,
            "t3": 1,
            "t4": 2,
            "t5": 3,
            "t6": 4,
            "t7": 5,
            "chủ nhật": 6,
            "chu nhat": 6,
            "cn": 6,
            "chunhat": 6,
            "c.n": 6,
            "cnhat": 6,
        }
        for label, weekday in weekday_map.items():
            if label in text:
                days_ahead = (weekday - now.weekday()) % 7
                if has_week_after_next:
                    # "thứ X tuần sau nữa": luôn là tuần sau nữa (2 tuần kể từ tuần hiện tại)
                    if days_ahead <= (6 - now.weekday()):
                        days_ahead += 14
                    else:
                        days_ahead += 7
                elif has_next_week:
                    # "thứ X tuần sau/tuần tới": chỉ +7 khi X vẫn nằm trong tuần hiện tại.
                    if days_ahead <= (6 - now.weekday()):
                        days_ahead += 7
                elif has_this_week:
                    days_ahead = days_ahead
                elif days_ahead == 0:
                    days_ahead = 7
                return (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
        return None

    def _extract_start_time(self, text: str) -> str | None:
        start_time_phrase = self._find_last_match(r"\bgio\s*bat\s*dau(?:\s*la)?\s*(\d{1,2})\s*(?:h|gio)?\b", text)
        if start_time_phrase:
            hour = int(start_time_phrase.group(1))
            if 0 <= hour <= 23:
                tail = text[start_time_phrase.end():start_time_phrase.end() + 16]
                if "chieu" in tail or "toi" in tail:
                    hour = hour + 12 if hour < 12 else hour
                return f"{hour:02d}:00"

        hour_half_word = self._find_last_match(r"\b(\d{1,2})\s*(?:gio|h)\s*ruoi\b", text)
        if hour_half_word:
            hour = int(hour_half_word.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:30"

        half_hour_short = re.search(r"\b(\d{1,2})\s*r\b", text)
        if half_hour_short:
            hour = int(half_hour_short.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:30"

        less_than_hour = self._find_last_match(r"\b(\d{1,2})\s*(?:h|gio)\s*kem\s*(\d{1,2})\b", text)
        if less_than_hour:
            hour = int(less_than_hour.group(1))
            minute = int(less_than_hour.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                total_min = hour * 60 - minute
                if total_min >= 0:
                    return f"{total_min // 60:02d}:{total_min % 60:02d}"

        more_than_hour = self._find_last_match(r"\b(\d{1,2})\s*(?:h|gio)\s*hon\s*(\d{1,2})\b", text)
        if more_than_hour:
            hour = int(more_than_hour.group(1))
            minute = int(more_than_hour.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"

        before_hour = self._find_last_match(r"\b(?:truoc)\s*(\d{1,2})\s*h\b", text)
        if before_hour:
            hour = int(before_hour.group(1))
            if 1 <= hour <= 23:
                return f"{hour - 1:02d}:00"

        after_hour = self._find_last_match(r"\b(?:sau)\s*(\d{1,2})\s*h\b", text)
        if after_hour:
            hour = int(after_hour.group(1))
            if 0 <= hour <= 22:
                return f"{hour + 1:02d}:00"

        exact_hg = self._find_last_match(r"\b(\d{1,2})\s*g\b", text)
        if exact_hg:
            hour = int(exact_hg.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:00"

        hour_word_minute = self._find_last_match(r"\b(\d{1,2})\s*gio\s*(\d{2})\b", text)
        if hour_word_minute:
            hour = int(hour_word_minute.group(1))
            minute = int(hour_word_minute.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"

        exact_gmm = self._find_last_match(r"\b(\d{1,2})\s*g\s*(\d{2})\b", text)
        if exact_gmm:
            hour = int(exact_gmm.group(1))
            minute = int(exact_gmm.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"

        exact_hhmm = self._find_last_match(r"\b(\d{1,2})[:h\.](\d{2})\b", text)
        if exact_hhmm:
            hour = int(exact_hhmm.group(1))
            minute = int(exact_hhmm.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"

        # Ví dụ: "vào 14h", "14h ngày 17"
        in_hour = self._find_last_match(r"\b(?:vao|luc|khoang)\s*(\d{1,2})\s*h\b", text)
        if in_hour:
            hour = int(in_hour.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:00"

        bare_hour = self._find_last_match(r"\b(\d{1,2})\s*h\b", text)
        if bare_hour:
            hour = int(bare_hour.group(1))
            if 0 <= hour <= 23:
                return f"{hour:02d}:00"

        exact_hour = re.search(r"\b(lúc|luc|khoảng|khoang)\s+(\d{1,2})h?\b", text)
        if exact_hour:
            hour = int(exact_hour.group(2))
            if 0 <= hour <= 23:
                if "chieu" in text or "toi" in text:
                    hour = hour + 12 if hour < 12 else hour
                return f"{hour:02d}:00"

        if "đầu giờ chiều" in text or "dau gio chieu" in text:
            return "13:00"
        if "cuoi gio chieu" in text or "cuối giờ chiều" in text:
            return "17:00"
        if "xế chiều" in text or "xe chieu" in text:
            return "15:00"
        if "đầu giờ sáng" in text or "dau gio sang" in text:
            return "08:00"
        if "đầu giờ tối" in text or "dau gio toi" in text:
            return "18:00"
        if "nua dem" in text or "nửa đêm" in text:
            return "00:00"
        if "dau gio" in text or "đầu giờ" in text:
            return "08:00"
        if "tối nay" in text or "toi nay" in text:
            return "18:00"
        if "trua nay" in text:
            return "11:00"
        if "chieu mai" in text:
            return "14:00"
        if "sang mot" in text:
            return "08:00"
        if "chieu toi" in text or "chiều tối" in text:
            return "17:00"
        if "gan trua" in text or "gần trưa" in text:
            return "11:00"
        if "cuoi buoi sang" in text or "cuối buổi sáng" in text:
            return "10:00"

        if "sáng" in text or "sang" in text:
            return "08:00"
        if "trưa" in text or "trua" in text:
            return "11:00"
        if "chiều" in text or "chieu" in text:
            return "14:00"
        if "tối" in text or "toi" in text:
            return "18:00"
        return None

    @staticmethod
    def _extract_invalid_minute_token(text: str) -> str | None:
        incomplete_more_less = re.search(r"\b(\d{1,2})\s*(?:h|gio)\s*(hon|kem)\b(?!\s*\d)", text)
        if incomplete_more_less:
            return f"{incomplete_more_less.group(1)} giờ {incomplete_more_less.group(2)}"

        for match in re.finditer(r"\b(\d{1,2})\s*(?::|h|g|gio)\s*(\d{2})\b", text):
            hour = int(match.group(1))
            minute = int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59 and minute not in (0, 30):
                return f"{hour}:{minute:02d}"

        for match in re.finditer(r"\b(\d{1,2})\s*(?:h|gio)\s*hon\s*(\d{1,2})\b", text):
            hour = int(match.group(1))
            minute = int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59 and minute not in (0, 30):
                return f"{hour}:{minute:02d}"

        for match in re.finditer(r"\b(\d{1,2})\s*(?:h|gio)\s*kem\s*(\d{1,2})\b", text):
            hour = int(match.group(1))
            minute = int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                total_min = hour * 60 - minute
                if total_min >= 0:
                    resolved_hour = total_min // 60
                    resolved_minute = total_min % 60
                    if resolved_minute not in (0, 30):
                        return f"{resolved_hour}:{resolved_minute:02d}"
        return None

    @staticmethod
    def _extract_invalid_duration_token(text: str) -> str | None:
        decimal_hours = re.search(r"\b(\d{1,2})[\.,](\d)\s*(?:tieng|gio|h)\b", text)
        if decimal_hours:
            decimal = int(decimal_hours.group(2))
            if decimal not in (0, 5):
                return f"{decimal_hours.group(1)}.{decimal}"

        mixed_hours = re.search(r"\b(\d{1,2})\s*(?:tieng|gio)\s+(\d{1,2})\b", text)
        if mixed_hours:
            minutes = int(mixed_hours.group(2))
            if minutes not in (0, 30):
                return f"{mixed_hours.group(1)} giờ {minutes}"

        minute_only = re.search(r"\b(\d{2,3})\s*p\b", text)
        if minute_only:
            minutes = int(minute_only.group(1))
            if minutes % 30 != 0:
                return f"{minutes} phút"
        return None

    @staticmethod
    def _find_last_match(pattern: str, text: str) -> re.Match[str] | None:
        matches = list(re.finditer(pattern, text))
        return matches[-1] if matches else None

    @staticmethod
    def _is_negated_keyword(text: str, start_idx: int, keyword_len: int) -> bool:
        left_window = text[max(0, start_idx - 28):start_idx]
        right_window = text[start_idx + keyword_len:start_idx + keyword_len + 18]
        left_negations = ("khong ", "khong can", "dung ", "khong phai", "ko ", "k ")
        if any(token in left_window for token in left_negations):
            return True
        if "khong can" in left_window or "chi " in left_window:
            return False
        if "khong" in right_window:
            return True
        return False

    def _apply_minute_granularity_guard(
        self,
        result: ParseChatResponse,
        invalid_minute_token: str | None,
    ) -> ParseChatResponse:
        if not invalid_minute_token:
            return result

        result.startTime = None
        result.missingFields = [field for field in result.missingFields if field != "startTime"]
        result.missingFields.append("startTime")
        result.followUpQuestion = (
            f"Bạn nhập giờ {invalid_minute_token}. Hệ thống chỉ hỗ trợ mốc phút 00 hoặc 30 "
            "(ví dụ 06:00 hoặc 06:30), bạn chọn lại giúp mình nhé?"
        )
        if result.raw is None:
            result.raw = {}
        result.raw["invalidMinuteTime"] = invalid_minute_token
        return result

    def _apply_duration_granularity_guard(
        self,
        result: ParseChatResponse,
        invalid_duration_token: str | None,
    ) -> ParseChatResponse:
        if not invalid_duration_token:
            return result

        result.durationHours = None
        result.missingFields = [field for field in result.missingFields if field != "durationHours"]
        result.missingFields.append("durationHours")
        result.followUpQuestion = (
            f"Bạn nhập số giờ {invalid_duration_token}. Hệ thống chỉ hỗ trợ mốc 00 hoặc 30 phút "
            "(ví dụ 2 giờ hoặc 2 giờ 30), bạn nhập lại giúp mình nhé?"
        )
        if result.raw is None:
            result.raw = {}
        result.raw["invalidDurationTime"] = invalid_duration_token
        return result

    def _apply_explicit_update_field_guard(self, result: ParseChatResponse, normalized_message: str) -> ParseChatResponse:
        has_start_time_update = any(
            token in normalized_message
            for token in (
                "gio bat dau",
                "bat dau luc",
                "gio vao lam",
                "start time",
            )
        )
        has_duration_update = any(
            token in normalized_message
            for token in (
                "so gio",
                "thoi luong",
                "tong gio",
                "duration",
            )
        )

        # Chỉ sửa giờ bắt đầu -> không được tự động ghi đè số giờ.
        if has_start_time_update and not has_duration_update:
            result.durationHours = None
            if isinstance(result.raw, dict):
                result.raw.pop("durationHours", None)

        # Chỉ sửa số giờ -> không được tự động ghi đè giờ bắt đầu.
        if has_duration_update and not has_start_time_update:
            result.startTime = None
            if isinstance(result.raw, dict):
                result.raw.pop("startTime", None)

        return result

    def _extract_address_text(self, message: str) -> str | None:
        lowered = self._normalize_text(message)
        if not self._has_address_hint(lowered):
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
        normalized = unicodedata.normalize("NFD", text)
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        normalized = normalized.replace("đ", "d").replace("Đ", "d").lower()
        normalized = re.sub(r"[^a-z0-9:\-\/\. ]+", " ", normalized)
        normalized = re.sub(r"\bthu[\-\.]?([2-7])\b", r"thu\1", normalized)
        normalized = re.sub(r"\bt[\-\.]?([2-7])\b", r"t\1", normalized)
        normalized = normalized.replace("c.n", "cn")
        normalized = re.sub(r"([a-z])\1{2,}", r"\1", normalized)
        normalized = normalized.replace("a thoi", "thoi")
        normalized = normalized.replace("a de", "de")
        normalized = " ".join(normalized.strip().split())
        for wrong, corrected in TYPO_REPLACEMENTS:
            normalized = normalized.replace(wrong, corrected)
        return normalized

    @staticmethod
    def _has_address_hint(normalized: str) -> bool:
        return any(hint in normalized for hint in ADDRESS_HINTS) or any(hint in normalized for hint in ADDRESS_SHORTCUT_HINTS)

    def _apply_invalid_request_fallback(self, message: str, result: ParseChatResponse) -> ParseChatResponse:
        if self._is_invalid_by_missing_and_intent(message, result):
            return self._build_invalid_request_response()
        return result

    def _is_invalid_by_missing_and_intent(self, message: str, result: ParseChatResponse) -> bool:
        normalized = self._normalize_text(message)
        if not normalized:
            return False

        has_service_keyword = any(
            keyword in normalized
            for keywords in SERVICE_KEYWORDS.values()
            for keyword in keywords
        )
        has_booking_hint = any(hint in normalized for hint in BOOKING_HINT_KEYWORDS)
        has_address_hint = self._has_address_hint(normalized)
        has_time_number = bool(re.search(r"\d+\s*(h|gio|tieng|g|p)\b", normalized))
        has_booking_signal = has_service_keyword or has_booking_hint or has_address_hint or has_time_number

        # Không có tín hiệu đặt lịch -> luôn coi như yêu cầu không hợp lệ,
        # kể cả khi AI model có thể suy đoán ra vài field.
        if not has_booking_signal:
            return True

        # Có tín hiệu đặt lịch thì cho phép đi tiếp để backend merge vào context phiên chat hiện tại.
        return False

    def _build_invalid_request_response(self) -> ParseChatResponse:
        return ParseChatResponse(
            categoryId=None,
            durationHours=None,
            workDate=None,
            startTime=None,
            serviceIds=[],
            addressText=None,
            needsAddressConfirmation=False,
            missingFields=[],
            followUpQuestion=INVALID_REQUEST_MESSAGE,
            confidence=0.0,
            source="rule_based",
            raw={"invalidRequest": True},
        )
