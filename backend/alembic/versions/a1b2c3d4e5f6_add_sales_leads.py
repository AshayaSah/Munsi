"""add sales_leads table

Revision ID: a1b2c3d4e5f6
Revises: <your_previous_revision_id>
Create Date: 2025-01-01 00:00:00.000000

Place this file in:  backend/alembic/versions/
Then run:           alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = None          # ← first migration, no parent
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sales_leads",

        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),

        sa.Column(
            "page_id", sa.String(64),
            sa.ForeignKey("pages.id", ondelete="CASCADE"),   # pages.id is the actual PK
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column("status",           sa.String(20),  nullable=False, server_default="interested"),
        sa.Column("customer_name",    sa.String(255), nullable=True),
        sa.Column("phone_number",     sa.String(50),  nullable=True),
        sa.Column("delivery_address", sa.Text,        nullable=True),
        sa.Column("product_interest", sa.Text,        nullable=True),
        sa.Column("order_notes",      sa.Text,        nullable=True),
        sa.Column("raw_extracted_json", sa.Text,      nullable=True),
        sa.Column("confidence",       sa.Float,       nullable=True),
        sa.Column("trigger_message",  sa.Text,        nullable=True),

        sa.Column(
            "detected_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
    )

    op.create_index("ix_sales_leads_page_id",     "sales_leads", ["page_id"])
    op.create_index("ix_sales_leads_user_id",     "sales_leads", ["user_id"])
    op.create_index("ix_sales_leads_status",      "sales_leads", ["status"])
    op.create_index("ix_sales_leads_page_status", "sales_leads", ["page_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_sales_leads_page_status", table_name="sales_leads")
    op.drop_index("ix_sales_leads_status",      table_name="sales_leads")
    op.drop_index("ix_sales_leads_user_id",     table_name="sales_leads")
    op.drop_index("ix_sales_leads_page_id",     table_name="sales_leads")
    op.drop_table("sales_leads")