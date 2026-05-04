"""AI domain request/response schemas."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ChatMessage(_Base):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class AIChatRequest(_Base):
    message: str = Field(min_length=1, max_length=12000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    as_of: str | None = None


class AIAnalysisResponse(_Base):
    message: str
    provider: Literal["local", "gemini"]
    external_call: bool
    feature_flags: dict[str, bool]


class TradeAnalysisRequest(_Base):
    prompt: str | None = Field(default=None, max_length=12000)
    as_of: str | None = None
