"""initial empty migration

Revision ID: 0001
Revises:
Create Date: 2026-05-03

Phase 0 placeholder. Phase 1's first domain migration will set its
`down_revision` to "0001".
"""

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
