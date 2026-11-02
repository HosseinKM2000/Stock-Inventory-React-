"""make stores the operational ownership boundary

Revision ID: 20261101_0009
Revises: 20261101_0008
Create Date: 2026-11-01

The upgrade intentionally stops on unresolved ownership or conflicting rows.
Operators must export and resolve the reported table before retrying; the
migration never chooses between duplicate customer records or combines values.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261101_0009"
down_revision = "20261101_0008"
branch_labels = None
depends_on = None


OWNED_TABLES = (
    "inventory_items",
    "categories",
    "labels",
    "custom_products",
    "inventory_transactions",
    "sync_operations",
    "sync_changes",
)


def _backfill_store(table: str) -> None:
    op.execute(sa.text(f"""
        UPDATE {table} AS target
        SET store_id = stores.id
        FROM stores
        WHERE target.store_id IS NULL
          AND stores.owner_user_id = target.user_id
    """))
    op.execute(sa.text(f"""
        UPDATE {table} AS target
        SET store_id = memberships.store_id
        FROM store_memberships AS memberships
        WHERE target.store_id IS NULL
          AND memberships.user_id = target.user_id
          AND memberships.store_id = (
              SELECT MIN(candidate.store_id)
              FROM store_memberships AS candidate
              WHERE candidate.user_id = target.user_id
              HAVING COUNT(DISTINCT candidate.store_id) = 1
          )
    """))


def _raise_if_exists(query: str, code: str) -> None:
    op.execute(sa.text(f"""
        DO $$
        BEGIN
            IF EXISTS ({query}) THEN
                RAISE EXCEPTION '{code}';
            END IF;
        END $$;
    """))


def upgrade() -> None:
    op.add_column("stores", sa.Column("industry_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_stores_industry", "stores", "industries", ["industry_id"], ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_stores_industry_id", "stores", ["industry_id"])
    op.execute(sa.text("""
        UPDATE stores
        SET industry_id = users.industry_id
        FROM users
        WHERE stores.owner_user_id = users.id
          AND stores.industry_id IS NULL
    """))

    for table in OWNED_TABLES:
        _backfill_store(table)
        _raise_if_exists(
            f"SELECT 1 FROM {table} WHERE store_id IS NULL",
            f"STORE_OWNERSHIP_PREFLIGHT:{table}:UNRESOLVED_STORE",
        )

    op.execute(sa.text("UPDATE sync_operations SET actor_user_id = user_id WHERE actor_user_id IS NULL"))
    op.execute(sa.text("UPDATE inventory_transactions SET actor_user_id = user_id WHERE actor_user_id IS NULL"))

    _raise_if_exists(
        "SELECT 1 FROM inventory_items i JOIN categories c ON c.id=i.category_id "
        "WHERE i.category_id IS NOT NULL AND i.store_id<>c.store_id",
        "STORE_OWNERSHIP_PREFLIGHT:inventory_items:CROSS_STORE_CATEGORY",
    )
    _raise_if_exists(
        "SELECT 1 FROM inventory_item_labels il "
        "JOIN inventory_items i ON i.id=il.inventory_item_id "
        "JOIN labels l ON l.id=il.label_id WHERE i.store_id<>l.store_id",
        "STORE_OWNERSHIP_PREFLIGHT:inventory_item_labels:CROSS_STORE_LABEL",
    )
    for query, code in (
        ("SELECT 1 FROM inventory_transactions t JOIN inventory_items i ON i.id=t.inventory_item_id WHERE t.store_id<>i.store_id", "inventory_transactions:CROSS_STORE_ITEM"),
        ("SELECT 1 FROM product_barcodes b JOIN inventory_items i ON i.id=b.inventory_item_id WHERE b.store_id<>i.store_id", "product_barcodes:CROSS_STORE_ITEM"),
        ("SELECT 1 FROM inventory_movements m JOIN inventory_items i ON i.id=m.product_id WHERE m.store_id<>i.store_id", "inventory_movements:CROSS_STORE_ITEM"),
        ("SELECT 1 FROM inventory_movements m JOIN product_barcodes b ON b.id=m.barcode_id WHERE m.barcode_id IS NOT NULL AND m.store_id<>b.store_id", "inventory_movements:CROSS_STORE_BARCODE"),
    ):
        _raise_if_exists(query, f"STORE_OWNERSHIP_PREFLIGHT:{code}")

    for query, code in (
        ("SELECT 1 FROM inventory_items GROUP BY store_id,catalog_product_id HAVING COUNT(*)>1", "inventory_items:DUPLICATE_CATALOG_ASSIGNMENT"),
        ("SELECT 1 FROM categories GROUP BY store_id,name HAVING COUNT(*)>1", "categories:DUPLICATE_NAME"),
        ("SELECT 1 FROM labels GROUP BY store_id,normalized_name HAVING COUNT(*)>1", "labels:DUPLICATE_NAME"),
        ("SELECT 1 FROM sync_operations GROUP BY store_id,actor_user_id,operation_id HAVING COUNT(*)>1", "sync_operations:DUPLICATE_ACTOR_OPERATION"),
    ):
        _raise_if_exists(query, f"STORE_OWNERSHIP_PREFLIGHT:{code}")

    for table in OWNED_TABLES:
        op.alter_column(table, "store_id", existing_type=sa.BigInteger(), nullable=False)
    op.alter_column("sync_operations", "actor_user_id", existing_type=sa.BigInteger(), nullable=False)
    op.alter_column("inventory_transactions", "actor_user_id", existing_type=sa.BigInteger(), nullable=False)

    op.drop_constraint("uq_categories_user_name", "categories", type_="unique")
    op.create_unique_constraint("uq_categories_store_name", "categories", ["store_id", "name"])
    op.create_unique_constraint("uq_categories_id_store", "categories", ["id", "store_id"])
    op.drop_constraint("uq_labels_user_normalized_name", "labels", type_="unique")
    op.create_unique_constraint("uq_labels_store_normalized_name", "labels", ["store_id", "normalized_name"])
    op.create_unique_constraint("uq_labels_id_store", "labels", ["id", "store_id"])
    op.drop_constraint("uq_inventory_items_user_catalog", "inventory_items", type_="unique")
    op.create_unique_constraint("uq_inventory_items_store_catalog", "inventory_items", ["store_id", "catalog_product_id"])
    op.create_unique_constraint("uq_inventory_items_id_store", "inventory_items", ["id", "store_id"])
    op.drop_index("ix_inventory_items_user_visibility_created", table_name="inventory_items")
    op.create_index(
        "ix_inventory_items_store_visibility_created", "inventory_items",
        ["store_id", "deleted_at", "is_hidden", "created_at"],
    )
    op.drop_constraint("uq_sync_user_operation", "sync_operations", type_="unique")
    op.create_unique_constraint(
        "uq_sync_store_actor_operation", "sync_operations",
        ["store_id", "actor_user_id", "operation_id"],
    )
    op.drop_constraint("uq_store_activity_operation", "store_activity", type_="unique")
    op.create_unique_constraint(
        "uq_store_activity_actor_operation", "store_activity",
        ["store_id", "actor_user_id", "operation_id"],
    )
    op.drop_constraint("uq_inventory_movements_store_operation", "inventory_movements", type_="unique")
    op.drop_constraint("uq_inventory_movements_store_reversal", "inventory_movements", type_="unique")
    op.create_unique_constraint(
        "uq_inventory_movements_store_actor_operation", "inventory_movements",
        ["store_id", "actor_user_id", "operation_id"],
    )
    op.create_unique_constraint(
        "uq_inventory_movements_store_actor_reversal", "inventory_movements",
        ["store_id", "actor_user_id", "reverses_operation_id"],
    )
    op.drop_index("ix_sync_changes_user_cursor", table_name="sync_changes")
    op.create_index("ix_sync_changes_store_cursor", "sync_changes", ["store_id", "id"])

    op.create_unique_constraint("uq_product_barcodes_id_store", "product_barcodes", ["id", "store_id"])
    op.create_foreign_key(
        "fk_inventory_items_category_store", "inventory_items", "categories",
        ["category_id", "store_id"], ["id", "store_id"],
    )
    op.create_foreign_key(
        "fk_inventory_transactions_inventory_store", "inventory_transactions", "inventory_items",
        ["inventory_item_id", "store_id"], ["id", "store_id"],
    )
    op.create_foreign_key(
        "fk_product_barcodes_inventory_store", "product_barcodes", "inventory_items",
        ["inventory_item_id", "store_id"], ["id", "store_id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_inventory_movements_product_store", "inventory_movements", "inventory_items",
        ["product_id", "store_id"], ["id", "store_id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_inventory_movements_barcode_store", "inventory_movements", "product_barcodes",
        ["barcode_id", "store_id"], ["id", "store_id"],
    )
    op.execute(sa.text("""
        CREATE FUNCTION enforce_inventory_item_label_store() RETURNS trigger AS $$
        BEGIN
            IF (SELECT store_id FROM inventory_items WHERE id=NEW.inventory_item_id)
               IS DISTINCT FROM
               (SELECT store_id FROM labels WHERE id=NEW.label_id) THEN
                RAISE EXCEPTION 'CROSS_STORE_INVENTORY_LABEL';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """))
    op.execute(sa.text("""
        CREATE TRIGGER trg_inventory_item_labels_same_store
        BEFORE INSERT OR UPDATE ON inventory_item_labels
        FOR EACH ROW EXECUTE FUNCTION enforce_inventory_item_label_store()
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_inventory_item_labels_same_store ON inventory_item_labels"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS enforce_inventory_item_label_store()"))
    op.drop_constraint("uq_inventory_movements_store_actor_reversal", "inventory_movements", type_="unique")
    op.drop_constraint("uq_inventory_movements_store_actor_operation", "inventory_movements", type_="unique")
    op.create_unique_constraint("uq_inventory_movements_store_reversal", "inventory_movements", ["store_id", "reverses_operation_id"])
    op.create_unique_constraint("uq_inventory_movements_store_operation", "inventory_movements", ["store_id", "operation_id"])
    op.drop_constraint("uq_store_activity_actor_operation", "store_activity", type_="unique")
    op.create_unique_constraint("uq_store_activity_operation", "store_activity", ["store_id", "operation_id"])
    for name, table in (
        ("fk_inventory_movements_barcode_store", "inventory_movements"),
        ("fk_inventory_movements_product_store", "inventory_movements"),
        ("fk_product_barcodes_inventory_store", "product_barcodes"),
        ("fk_inventory_transactions_inventory_store", "inventory_transactions"),
        ("fk_inventory_items_category_store", "inventory_items"),
    ):
        op.drop_constraint(name, table, type_="foreignkey")
    op.drop_constraint("uq_product_barcodes_id_store", "product_barcodes", type_="unique")
    op.drop_index("ix_sync_changes_store_cursor", table_name="sync_changes")
    op.create_index("ix_sync_changes_user_cursor", "sync_changes", ["user_id", "id"])
    op.drop_constraint("uq_sync_store_actor_operation", "sync_operations", type_="unique")
    op.create_unique_constraint("uq_sync_user_operation", "sync_operations", ["user_id", "operation_id"])
    op.drop_index("ix_inventory_items_store_visibility_created", table_name="inventory_items")
    op.create_index("ix_inventory_items_user_visibility_created", "inventory_items", ["user_id", "deleted_at", "is_hidden", "created_at"])
    op.drop_constraint("uq_inventory_items_id_store", "inventory_items", type_="unique")
    op.drop_constraint("uq_inventory_items_store_catalog", "inventory_items", type_="unique")
    op.create_unique_constraint("uq_inventory_items_user_catalog", "inventory_items", ["user_id", "catalog_product_id"])
    op.drop_constraint("uq_labels_id_store", "labels", type_="unique")
    op.drop_constraint("uq_labels_store_normalized_name", "labels", type_="unique")
    op.create_unique_constraint("uq_labels_user_normalized_name", "labels", ["user_id", "normalized_name"])
    op.drop_constraint("uq_categories_id_store", "categories", type_="unique")
    op.drop_constraint("uq_categories_store_name", "categories", type_="unique")
    op.create_unique_constraint("uq_categories_user_name", "categories", ["user_id", "name"])
    for table in OWNED_TABLES:
        op.alter_column(table, "store_id", existing_type=sa.BigInteger(), nullable=True)
    op.alter_column("sync_operations", "actor_user_id", existing_type=sa.BigInteger(), nullable=True)
    op.alter_column("inventory_transactions", "actor_user_id", existing_type=sa.BigInteger(), nullable=True)
    op.drop_index("ix_stores_industry_id", table_name="stores")
    op.drop_constraint("fk_stores_industry", "stores", type_="foreignkey")
    op.drop_column("stores", "industry_id")
