"""tenants and monetization scaffold

Revision ID: 0005_tenants_monetization
Revises: 0004_auth_multi_user
Create Date: 2026-05-04
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_tenants_monetization"
down_revision: str | None = "0004_auth_multi_user"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _create_index(table_name: str, index_name: str, columns: list[str]) -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name not in existing:
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("tenants"):
        op.create_table(
            "tenants",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("slug", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("domain", sa.String(), nullable=True),
            sa.Column("logo_url", sa.String(), nullable=True),
            sa.Column("primary_color", sa.String(), nullable=False),
            sa.Column("secondary_color", sa.String(), nullable=False),
            sa.Column("font_family", sa.String(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("plan", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("slug"),
            sa.UniqueConstraint("domain"),
        )
    _create_index("tenants", "ix_tenants_slug", ["slug"])
    _create_index("tenants", "ix_tenants_domain", ["domain"])
    _create_index("tenants", "ix_tenants_is_active", ["is_active"])
    _create_index("tenants", "ix_tenants_plan", ["plan"])

    if not inspector.has_table("tenant_settings"):
        op.create_table(
            "tenant_settings",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), nullable=False),
            sa.Column("setting_key", sa.String(), nullable=False),
            sa.Column("setting_value", sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("tenant_settings", "ix_tenant_settings_tenant_id", ["tenant_id"])
    _create_index("tenant_settings", "ix_tenant_settings_setting_key", ["setting_key"])

    if not inspector.has_table("feature_flags"):
        op.create_table(
            "feature_flags",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("feature_name", sa.String(), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("limit_value", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("feature_flags", "ix_feature_flags_user_id", ["user_id"])
    _create_index("feature_flags", "ix_feature_flags_feature_name", ["feature_name"])
    _create_index("feature_flags", "ix_feature_flags_enabled", ["enabled"])

    if not inspector.has_table("usage_events"):
        op.create_table(
            "usage_events",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("feature", sa.String(), nullable=False),
            sa.Column("count", sa.Integer(), nullable=False),
            sa.Column("period", sa.String(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("usage_events", "ix_usage_events_user_id", ["user_id"])
    _create_index("usage_events", "ix_usage_events_feature", ["feature"])
    _create_index("usage_events", "ix_usage_events_period", ["period"])

    if not _has_column("trades", "tenant_id"):
        op.add_column("trades", sa.Column("tenant_id", sa.String(), nullable=True))
    _create_index("trades", "ix_trades_tenant_id", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_trades_tenant_id", table_name="trades")
    op.drop_column("trades", "tenant_id")
    op.drop_table("usage_events")
    op.drop_table("feature_flags")
    op.drop_table("tenant_settings")
    op.drop_table("tenants")

