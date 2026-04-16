from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import get_settings
from .parser_service import ChatParserService
from .schemas import ParseChatRequest, ParseChatResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.chat_parser = ChatParserService(settings)
    yield


app = FastAPI(
    title="HomeConnect AI Parser",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/chat/parse", response_model=ParseChatResponse)
async def parse_chat(request: ParseChatRequest) -> ParseChatResponse:
    parser: ChatParserService = app.state.chat_parser
    return parser.parse(request.message)
