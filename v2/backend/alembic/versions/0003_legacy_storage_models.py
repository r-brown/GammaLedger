"""legacy storage compatibility models

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-04
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "legacy_import_batches",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("source_version", sa.String(), nullable=True),
        sa.Column("export_date", sa.DateTime(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("source_shape", sa.String(), nullable=False),
        sa.Column("mcp_context", sa.JSON(), nullable=True),
        sa.Column("source_trade_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_leg_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_financial_checksum", sa.Float(), nullable=False, server_default="0"),
        sa.Column("imported_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "trade_runtime_snapshots",
        sa.Column(
            "trade_id",
            sa.String(),
            sa.ForeignKey("trades.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("fields", sa.JSON(), nullable=False),
    )
    op.create_table(
        "leg_import_metadata",
        sa.Column(
            "leg_id",
            sa.String(),
            sa.ForeignKey("legs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("external_id", sa.String(), nullable=True, index=True),
        sa.Column("import_group_id", sa.String(), nullable=True, index=True),
        sa.Column("import_source", sa.String(), nullable=True),
        sa.Column("import_batch_id", sa.String(), nullable=True, index=True),
        sa.Column("ticker_symbol", sa.String(), nullable=True, index=True),
        sa.Column("raw", sa.JSON(), nullable=False),
    )
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "consent_records",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "api_credential_configs",
        sa.Column("service", sa.String(), primary_key=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("encrypted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("fallback", sa.String(), nullable=True),
        sa.Column("secret_material", sa.String(), nullable=True),
        sa.Column("max_tokens", sa.Integer(), nullable=True),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=True),
        sa.Column(
            "migrated_plaintext_present",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("api_credential_configs")
    op.drop_table("consent_records")
    op.drop_table("app_settings")
    op.drop_table("leg_import_metadata")
    op.drop_table("trade_runtime_snapshots")
    op.drop_table("legacy_import_batches")
