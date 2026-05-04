"""Pydantic schemas for hosted auth and user resources."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class AuthFeatures(_Base):
    auth_enabled: bool
    local_mode: bool
    local_user_id: str
    access_token_minutes: int
    refresh_token_days: int
    oauth_providers: list[str]


class UserRead(_Base):
    id: str
    email: str
    is_verified: bool
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class RegisterRequest(_Base):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(_Base):
    email: str = Field(min_length=3, max_length=320)
    password: str


class VerifyRequest(_Base):
    email: str = Field(min_length=3, max_length=320)
    token: str | None = None


class RefreshRequest(_Base):
    refresh_token: str


class TokenResponse(_Base):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class UserProfileRead(_Base):
    user_id: str
    display_name: str | None = None
    timezone: str
    currency: str
    default_portfolio_id: str | None = None


class PortfolioRead(_Base):
    id: str
    user_id: str
    tenant_id: str | None = None
    name: str
    description: str | None = None
    is_default: bool
    created_at: datetime


class UserPreferencesRead(_Base):
    user_id: str
    theme: str
    date_format: str
    number_format: str
    notification_settings: dict[str, Any]


class OAuthStub(_Base):
    provider: str
    enabled: bool = False
    message: str
