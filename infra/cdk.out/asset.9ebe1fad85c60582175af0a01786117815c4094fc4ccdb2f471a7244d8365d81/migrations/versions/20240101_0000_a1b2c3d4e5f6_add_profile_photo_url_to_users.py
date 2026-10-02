"""Add profile_photo_url to users table

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2024-01-01 00:00:00.000000

Adds the `profile_photo_url` column (nullable VARCHAR 500) to the `users`
table.  This column stores either a direct S3 URL or a CloudFront CDN URL
for the user's profile photo.

Upgrade:  ALTER TABLE users ADD COLUMN profile_photo_url VARCHAR(500)
Downgrade: ALTER TABLE users DROP COLUMN profile_photo_url
"""

from alembic import op
import sqlalchemy as sa

# ── Revision identifiers ──────────────────────────────────────────────────────
revision = "a1b2c3d4e5f6"
down_revision = None   # set to previous revision ID if chaining migrations
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add profile_photo_url column to the users table."""
    # Use batch mode so this works with SQLite (which doesn't support ALTER
    # COLUMN natively).  On PostgreSQL/MySQL the batch wrapper is a no-op.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "profile_photo_url",
                sa.String(length=500),
                nullable=True,
                comment="S3 or CloudFront URL of the user's profile photo",
            )
        )


def downgrade() -> None:
    """Remove profile_photo_url column from the users table."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("profile_photo_url")
