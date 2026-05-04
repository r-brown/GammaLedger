"""Tenant API schemas."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class TenantConfig(_Base):
    id: str
    slug: str
    name: str
    domain: str | None = None
    logo_url: str | None = None
    primary_color: str
    secondary_color: str
    font_family: str
    plan: str
    settings: dict[str, object]
    resolved_from: str

