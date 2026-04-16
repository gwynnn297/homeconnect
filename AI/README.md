# HomeConnect AI Parser

Python service parse tin nhắn tiếng Việt của khách thành dữ liệu đặt lịch có cấu trúc cho HomeConnect.

## Mục tiêu

Service này cung cấp API:

- `POST /api/v1/chat/parse`

Input:

```json
{
  "message": "Dọn nhà 3 tiếng sáng mai"
}
```

Output mẫu:

```json
{
  "categoryId": 1,
  "durationHours": 3,
  "workDate": "2026-04-17",
  "startTime": "08:00",
  "serviceIds": [],
  "addressText": null,
  "needsAddressConfirmation": true,
  "missingFields": [],
  "followUpQuestion": null,
  "confidence": 0.95,
  "source": "rule_based"
}
```

## Cấu trúc thư mục

```text
AI/
  app/
    config.py
    main.py
    parser_service.py
    prompts.py
    schemas.py
  .env.example
  requirements.txt
  README.md
```

## Cài đặt

```bash
cd AI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Nếu muốn dùng OpenAI thật, điền `OPENAI_API_KEY` vào `.env`.

## Chạy local

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoint

### `POST /api/v1/chat/parse`

Request:

```json
{
  "message": "Trông trẻ 4 tiếng chiều mai"
}
```

Response:

```json
{
  "categoryId": 5,
  "durationHours": 4,
  "workDate": "2026-04-17",
  "startTime": "14:00",
  "serviceIds": [],
  "addressText": null,
  "needsAddressConfirmation": true,
  "missingFields": [],
  "followUpQuestion": null,
  "confidence": 0.95,
  "source": "rule_based"
}
```

## Ghi chú tích hợp

- Output dùng `categoryId`, không dùng `service_id`.
- `needsAddressConfirmation` luôn mặc định `true` vì flow booking hiện tại vẫn cần người dùng chọn `addressId`.
- `serviceIds` đang để mặc định `[]` cho MVP.
- Khi chưa có `OPENAI_API_KEY`, service vẫn chạy bằng parser rule-based để thuận tiện dev và test FE.

##Chạy app
cd AI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

##Để chạy đc cần cài 
pip install tzdata