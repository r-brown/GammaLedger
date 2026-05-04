"""trades + legs tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-03

Phase 1: persisted-only fields per DOMAIN_MODEL_MAP §2 / §3. Runtime fields
are computed on read and never stored.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trades",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("ticker", sa.String(), nullable=False, index=True),
        sa.Column("strategy", sa.String(), nullable=False),
        sa.Column("underlying_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, index=True),
        sa.Column("opened_date", sa.Date(), nullable=False, index=True),
        sa.Column("closed_date", sa.Date(), nullable=True),
        sa.Column("expiration_date", sa.Date(), nullable=True),
        sa.Column("exit_reason", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("max_risk_override", sa.Float(), nullable=True),
        sa.Column("status_override", sa.String(), nullable=True),
    )
    op.create_table(
        "legs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "trade_id",
            sa.String(),
            sa.ForeignKey("trades.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("order_type", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("multiplier", sa.Float(), nullable=False),
        sa.Column("execution_date", sa.Date(), nullable=True),
        sa.Column("expiration_date", sa.Date(), nullable=True),
        sa.Column("strike", sa.Float(), nullable=True),
        sa.Column("premium", sa.Float(), nullable=False, server_default="0"),
        sa.Column("fees", sa.Float(), nullable=False, server_default="0"),
        sa.Column("underlying_price", sa.Float(), nullable=True),
        sa.Column("underlying_type", sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("legs")
    op.drop_table("trades")
