"""auth and multi-user scaffold

Revision ID: 0004_auth_multi_user
Revises: 0003
Create Date: 2026-05-04
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_auth_multi_user"
down_revision: str | None = "0003"
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
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("hashed_password", sa.String(), nullable=False),
            sa.Column("is_verified", sa.Boolean(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("last_login_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
        )
    _create_index("users", "ix_users_email", ["email"])
    _create_index("users", "ix_users_is_active", ["is_active"])
    _create_index("users", "ix_users_is_verified", ["is_verified"])

    if not inspector.has_table("portfolios"):
        op.create_table(
            "portfolios",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), nullable=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("is_default", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("portfolios", "ix_portfolios_user_id", ["user_id"])
    _create_index("portfolios", "ix_portfolios_tenant_id", ["tenant_id"])
    _create_index("portfolios", "ix_portfolios_is_default", ["is_default"])

    if not inspector.has_table("user_profiles"):
        op.create_table(
            "user_profiles",
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("display_name", sa.String(), nullable=True),
            sa.Column("timezone", sa.String(), nullable=False),
            sa.Column("currency", sa.String(), nullable=False),
            sa.Column("default_portfolio_id", sa.String(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )
    _create_index(
        "user_profiles",
        "ix_user_profiles_default_portfolio_id",
        ["default_portfolio_id"],
    )

    if not inspector.has_table("user_preferences"):
        op.create_table(
            "user_preferences",
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("theme", sa.String(), nullable=False),
            sa.Column("date_format", sa.String(), nullable=False),
            sa.Column("number_format", sa.String(), nullable=False),
            sa.Column("notification_settings", sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if not inspector.has_table("refresh_tokens"):
        op.create_table(
            "refresh_tokens",
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("token_hash"),
        )
    _create_index("refresh_tokens", "ix_refresh_tokens_user_id", ["user_id"])
    _create_index("refresh_tokens", "ix_refresh_tokens_expires_at", ["expires_at"])
    _create_index("refresh_tokens", "ix_refresh_tokens_revoked_at", ["revoked_at"])

    if not inspector.has_table("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("entity", sa.String(), nullable=False),
            sa.Column("entity_id", sa.String(), nullable=True),
            sa.Column("timestamp", sa.DateTime(), nullable=False),
            sa.Column("detail", sa.JSON(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("audit_logs", "ix_audit_logs_user_id", ["user_id"])
    _create_index("audit_logs", "ix_audit_logs_action", ["action"])
    _create_index("audit_logs", "ix_audit_logs_entity", ["entity"])
    _create_index("audit_logs", "ix_audit_logs_entity_id", ["entity_id"])
    _create_index("audit_logs", "ix_audit_logs_timestamp", ["timestamp"])

    if not _has_column("trades", "user_id"):
        op.add_column(
            "trades", sa.Column("user_id", sa.String(), nullable=False, server_default="local")
        )
    if not _has_column("trades", "portfolio_id"):
        op.add_column("trades", sa.Column("portfolio_id", sa.String(), nullable=True))
    _create_index("trades", "ix_trades_user_id", ["user_id"])
    _create_index("trades", "ix_trades_portfolio_id", ["portfolio_id"])

    if not _has_column("legacy_import_batches", "user_id"):
        op.add_column(
            "legacy_import_batches",
            sa.Column("user_id", sa.String(), nullable=False, server_default="local"),
        )
    _create_index("legacy_import_batches", "ix_legacy_import_batches_user_id", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_legacy_import_batches_user_id", table_name="legacy_import_batches")
    op.drop_column("legacy_import_batches", "user_id")
    op.drop_index("ix_trades_portfolio_id", table_name="trades")
    op.drop_index("ix_trades_user_id", table_name="trades")
    op.drop_column("trades", "portfolio_id")
    op.drop_column("trades", "user_id")
    op.drop_table("audit_logs")
    op.drop_table("refresh_tokens")
    op.drop_table("user_preferences")
    op.drop_index("ix_user_profiles_default_portfolio_id", table_name="user_profiles")
    op.drop_table("user_profiles")
    op.drop_index("ix_portfolios_is_default", table_name="portfolios")
    op.drop_index("ix_portfolios_tenant_id", table_name="portfolios")
    op.drop_index("ix_portfolios_user_id", table_name="portfolios")
    op.drop_table("portfolios")
    op.drop_index("ix_users_is_verified", table_name="users")
    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
