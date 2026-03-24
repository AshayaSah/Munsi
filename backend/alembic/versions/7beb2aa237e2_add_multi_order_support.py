"""add_multi_order_support

Revision ID: 7beb2aa237e2
Revises: 736b3ad91e52
Create Date: 2026-03-24 07:06:35.379679

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7beb2aa237e2'
down_revision: Union[str, Sequence[str], None] = '736b3ad91e52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.add_column('users', sa.Column('remembered_name', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('remembered_phone', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('remembered_address', sa.Text, nullable=True))
    op.add_column('sales_leads', sa.Column('order_ref_id', sa.String(32), nullable=True))
    op.add_column('sales_leads', sa.Column('parent_lead_id', sa.Integer,
        sa.ForeignKey('sales_leads.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_sales_leads_order_ref_id', 'sales_leads', ['order_ref_id'])
    op.execute("UPDATE sales_leads SET order_ref_id = 'ORD-' || LPAD(id::TEXT, 4, '0') WHERE order_ref_id IS NULL")

def downgrade():
    op.drop_index('ix_sales_leads_order_ref_id')
    op.drop_column('sales_leads', 'parent_lead_id')
    op.drop_column('sales_leads', 'order_ref_id')
    op.drop_column('users', 'remembered_address')
    op.drop_column('users', 'remembered_phone')
    op.drop_column('users', 'remembered_name')
