"""add explicit store operating mode and immutable operation policy context

Revision ID: 20261102_0010
Revises: 20261101_0009
Create Date: 2026-11-02

Legacy stores with active personnel are initialized to team mode; owner-only
stores initialize to solo. Missing or ambiguous active owner membership blocks
the transaction with actionable store identifiers instead of guessing.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261102_0010"
down_revision = "20261101_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        DO $$
        DECLARE affected text;
        BEGIN
          SELECT string_agg(store_id::text, ',' ORDER BY store_id) INTO affected
          FROM (
            SELECT s.id AS store_id
            FROM stores s
            LEFT JOIN store_memberships m
              ON m.store_id=s.id AND m.is_owner=true AND m.status='active'
            GROUP BY s.id
            HAVING count(m.id) <> 1
            ORDER BY s.id
            LIMIT 20
          ) bad;
          IF affected IS NOT NULL THEN
            RAISE EXCEPTION 'STORE_MODE_PREFLIGHT:ACTIVE_OWNER:store_ids=%', affected;
          END IF;
        END $$;
    """))
    op.add_column("stores", sa.Column("operating_mode", sa.String(10), nullable=True))
    op.add_column("stores", sa.Column("policy_version", sa.Integer(), nullable=True))
    op.add_column("stores", sa.Column("policy_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("stores", sa.Column("policy_changed_by_user_id", sa.BigInteger(), nullable=True))
    op.execute(sa.text("""
        UPDATE stores s
        SET operating_mode = CASE WHEN EXISTS (
              SELECT 1 FROM store_memberships m
              WHERE m.store_id=s.id AND NOT m.is_owner AND m.status='active'
            ) THEN 'team' ELSE 'solo' END,
            policy_version = 1,
            policy_changed_at = COALESCE(s.updated_at, s.created_at, now()),
            policy_changed_by_user_id = s.owner_user_id
    """))
    op.alter_column("stores", "operating_mode", nullable=False, server_default="solo")
    op.alter_column("stores", "policy_version", nullable=False, server_default="1")
    op.alter_column("stores", "policy_changed_at", nullable=False, server_default=sa.text("now()"))
    op.create_check_constraint("ck_stores_operating_mode", "stores", "operating_mode IN ('solo','team')")
    op.create_check_constraint("ck_stores_policy_version", "stores", "policy_version >= 1")
    op.create_foreign_key(
        "fk_stores_policy_actor", "stores", "users",
        ["policy_changed_by_user_id"], ["id"], ondelete="RESTRICT",
    )

    op.add_column("sync_operations", sa.Column("execution_mode", sa.String(10), nullable=True))
    op.add_column("sync_operations", sa.Column("policy_version", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_sync_operations_execution_mode", "sync_operations",
        "execution_mode IS NULL OR execution_mode IN ('solo','team')",
    )
    op.create_check_constraint(
        "ck_sync_operations_policy_version", "sync_operations",
        "policy_version IS NULL OR policy_version >= 1",
    )

    op.create_table(
        "store_mode_transitions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("store_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_membership_id", sa.BigInteger(), nullable=False),
        sa.Column("transition_id", sa.String(64), nullable=False),
        sa.Column("from_mode", sa.String(10), nullable=False),
        sa.Column("to_mode", sa.String(10), nullable=False),
        sa.Column("from_policy_version", sa.Integer(), nullable=False),
        sa.Column("to_policy_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_membership_id"], ["store_memberships.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "transition_id", name="uq_store_mode_transition_request"),
        sa.CheckConstraint("from_mode IN ('solo','team')", name="ck_mode_transition_from"),
        sa.CheckConstraint("to_mode IN ('solo','team')", name="ck_mode_transition_to"),
    )
    op.create_index("ix_store_mode_transitions_store_id", "store_mode_transitions", ["store_id"])
    op.create_index("ix_store_mode_transitions_actor_user_id", "store_mode_transitions", ["actor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_store_mode_transitions_actor_user_id", table_name="store_mode_transitions")
    op.drop_index("ix_store_mode_transitions_store_id", table_name="store_mode_transitions")
    op.drop_table("store_mode_transitions")
    op.drop_constraint("ck_sync_operations_policy_version", "sync_operations", type_="check")
    op.drop_constraint("ck_sync_operations_execution_mode", "sync_operations", type_="check")
    op.drop_column("sync_operations", "policy_version")
    op.drop_column("sync_operations", "execution_mode")
    op.drop_constraint("fk_stores_policy_actor", "stores", type_="foreignkey")
    op.drop_constraint("ck_stores_policy_version", "stores", type_="check")
    op.drop_constraint("ck_stores_operating_mode", "stores", type_="check")
    op.drop_column("stores", "policy_changed_by_user_id")
    op.drop_column("stores", "policy_changed_at")
    op.drop_column("stores", "policy_version")
    op.drop_column("stores", "operating_mode")
