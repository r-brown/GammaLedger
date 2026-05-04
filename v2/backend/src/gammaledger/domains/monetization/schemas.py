"""Schemas for feature flags and usage metering."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class FeatureFlagRead(_Base):
    feature_name: str
    enabled: bool
    limit_value: int | None = None


class UsageRead(_Base):
    feature: str
    count: int
    period: str
    limit_value: int | None = None

