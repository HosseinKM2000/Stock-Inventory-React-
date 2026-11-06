
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone

from .database import Base


ENTITY_ID = BigInteger().with_variant(Integer, "sqlite")
UTC_DATETIME = DateTime(timezone=True)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- User ----------
class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("phone", name="uq_users_phone_canonical"),
        CheckConstraint(
            "(device_limit_mode IN ('inherit', 'unlimited') AND device_limit_override IS NULL) OR "
            "(device_limit_mode = 'limited' AND device_limit_override > 0)",
            name="ck_users_device_limit_policy",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)

    first_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    username: Mapped[str] = mapped_column(
        String(120),
        unique=True,
        index=True
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    phone: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True
    )

    hashed_password: Mapped[str] = mapped_column(String(255))

    plan: Mapped[str] = mapped_column(
        String(30),
        default="free"
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(20), default="USER", index=True)
    is_system_admin: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    system_key: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    subscription_started_at: Mapped[datetime | None] = mapped_column(
        UTC_DATETIME, nullable=True
    )
    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        UTC_DATETIME, nullable=True
    )
    device_limit_mode: Mapped[str] = mapped_column(String(20), default="inherit")
    device_limit_override: Mapped[int | None] = mapped_column(Integer, nullable=True)

    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("industries.id"),
        nullable=True,
        index=True,
    )

    industry: Mapped["Industry | None"] = relationship(
    back_populates="users"
    )

    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_now
    )

    categories: Mapped[list["Category"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    labels: Mapped[list["Label"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )

    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    custom_products: Mapped[list["CustomProduct"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    transactions: Mapped[list["InventoryTransaction"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    sessions: Mapped[list["UserSession"]]  = relationship(
    "UserSession",
    back_populates="user",
    cascade="all, delete-orphan",
    )

    store_memberships: Mapped[list["StoreMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), unique=True, index=True
    )
    plan: Mapped[str] = mapped_column(String(30), default="free")
    subscription_started_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    subscription_expires_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    personnel_limit_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("industries.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    operating_mode: Mapped[str] = mapped_column(String(10), default="solo")
    policy_version: Mapped[int] = mapped_column(Integer, default=1)
    policy_changed_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    policy_changed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, onupdate=_now)

    owner: Mapped["User"] = relationship(foreign_keys=[owner_user_id])
    memberships: Mapped[list["StoreMembership"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )
    roles: Mapped[list["StoreRole"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )


class StoreModeTransition(Base):
    __tablename__ = "store_mode_transitions"
    __table_args__ = (
        UniqueConstraint("store_id", "transition_id", name="uq_store_mode_transition_request"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    actor_membership_id: Mapped[int] = mapped_column(ForeignKey("store_memberships.id", ondelete="RESTRICT"))
    transition_id: Mapped[str] = mapped_column(String(64))
    from_mode: Mapped[str] = mapped_column(String(10))
    to_mode: Mapped[str] = mapped_column(String(10))
    from_policy_version: Mapped[int] = mapped_column(Integer)
    to_policy_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)


class StoreRole(Base):
    __tablename__ = "store_roles"
    __table_args__ = (UniqueConstraint("store_id", "name", name="uq_store_roles_store_name"),)

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    permissions_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, onupdate=_now)

    store: Mapped["Store"] = relationship(back_populates="roles")
    memberships: Mapped[list["StoreMembership"]] = relationship(back_populates="role")


class StoreMembership(Base):
    __tablename__ = "store_memberships"
    __table_args__ = (
        UniqueConstraint("store_id", "user_id", name="uq_store_memberships_store_user"),
        CheckConstraint("status IN ('active', 'inactive')", name="ck_store_memberships_status"),
        CheckConstraint(
            "(is_owner AND role_id IS NULL) OR (NOT is_owner AND role_id IS NOT NULL)",
            name="ck_store_memberships_owner_role",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    role_id: Mapped[int | None] = mapped_column(ForeignKey("store_roles.id", ondelete="RESTRICT"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    temporary_password_required: Mapped[bool] = mapped_column(Boolean, default=False)
    credentials_notice_viewed_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    authorization_checked_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, onupdate=_now)

    store: Mapped["Store"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="store_memberships")
    role: Mapped["StoreRole | None"] = relationship(back_populates="memberships")


class StoreActivity(Base):
    __tablename__ = "store_activity"
    __table_args__ = (
        UniqueConstraint(
            "store_id", "actor_user_id", "operation_id",
            name="uq_store_activity_actor_operation",
        ),
        Index("ix_store_activity_store_accepted", "store_id", "accepted_at"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    actor_membership_id: Mapped[int] = mapped_column(BigInteger, index=True)
    actor_display_name: Mapped[str] = mapped_column(String(250))
    actor_role_name: Mapped[str] = mapped_column(String(100))
    operation_id: Mapped[str] = mapped_column(String(80))
    target_entity: Mapped[str] = mapped_column(String(50), index=True)
    target_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    before_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str] = mapped_column(String(20), index=True)
    client_occurred_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    accepted_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, index=True)


class UserSession(Base):
    __tablename__ = "user_sessions"
    __table_args__ = (
        Index(
            "ix_user_sessions_user_fingerprint_active",
            "user_id",
            "device_fingerprint",
            "is_active",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    device_fingerprint: Mapped[str] = mapped_column(
        String(255),
        index=True,
    )

    access_token: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_now,
    )

    last_seen: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_now,
        onupdate=_now,
    )

    user: Mapped["User"] = relationship(
        back_populates="sessions",
    )


# ---------- Category ----------
class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("store_id", "name", name="uq_categories_store_name"),
        UniqueConstraint("id", "store_id", name="uq_categories_id_store"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)

    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_now, onupdate=_now
    )

    owner: Mapped["User"] = relationship(back_populates="categories")


class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (
        UniqueConstraint("store_id", "normalized_name", name="uq_labels_store_normalized_name"),
        UniqueConstraint("id", "store_id", name="uq_labels_id_store"),
    )
    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    normalized_name: Mapped[str] = mapped_column(String(60))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, onupdate=_now)
    owner: Mapped["User"] = relationship(back_populates="labels")
    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        secondary="inventory_item_labels", back_populates="labels"
    )


class InventoryItemLabel(Base):
    __tablename__ = "inventory_item_labels"
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"), primary_key=True
    )
    label_id: Mapped[int] = mapped_column(
        ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True
    )


# ---------- Shared Catalog ----------
class CatalogProduct(Base):
    __tablename__ = "catalog_products"
    __table_args__ = (
        CheckConstraint(
            "(NOT is_packaged AND pack_size IS NULL) OR "
            "(is_packaged AND pack_size > 0)",
            name="ck_catalog_products_packaging",
        ),
        Index(
            "ix_catalog_products_shared_active_industry_created",
            "is_shared",
            "is_active",
            "industry_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)

    industry_id: Mapped[int] = mapped_column(
        ForeignKey("industries.id"),
        index=True,
    )

    industry: Mapped["Industry"] = relationship(
        back_populates="catalog_products"
    )

    name: Mapped[str] = mapped_column(
        String(200),
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    brand: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    is_packaged: Mapped[bool] = mapped_column(Boolean, default=False)
    pack_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Legacy user-created products are represented by a private catalog row
    # because inventory_items.catalog_product_id is currently non-nullable.
    # Only shared rows belong to the administrator-managed catalog.
    is_shared: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # Archive/restore toggles this flag. Permanent deletion is an explicit,
    # transactional service operation that deletes dependent inventory first.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_now,
    )

    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        back_populates="catalog_product"
    )

# ---------- Durable product media ----------
class MediaAsset(Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        UniqueConstraint(
            "store_id", "actor_user_id", "transfer_id",
            name="uq_media_assets_store_actor_transfer",
        ),
        Index("ix_media_assets_store_created", "store_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    transfer_id: Mapped[str] = mapped_column(String(36))
    content_sha256: Mapped[str] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(80))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1)
    available_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)


# ---------- User Inventory ----------
class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "catalog_product_id",
            name="uq_inventory_items_store_catalog",
        ),
        UniqueConstraint("id", "store_id", name="uq_inventory_items_id_store"),
        ForeignKeyConstraint(
            ["category_id", "store_id"],
            ["categories.id", "categories.store_id"],
            name="fk_inventory_items_category_store",
        ),
        CheckConstraint("quantity >= 0", name="ck_inventory_items_quantity"),
        CheckConstraint("price >= 0", name="ck_inventory_items_price"),
        CheckConstraint("sale_price IS NULL OR sale_price >= 0", name="ck_inventory_items_sale_price"),
        CheckConstraint("purchase_price IS NULL OR purchase_price >= 0", name="ck_inventory_items_purchase_price"),
        CheckConstraint(
            "low_stock_threshold >= 0",
            name="ck_inventory_items_low_stock_threshold",
        ),
        Index(
            "ix_inventory_items_store_visibility_created",
            "store_id",
            "deleted_at",
            "is_hidden",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    catalog_product_id: Mapped[int] = mapped_column(
        ForeignKey("catalog_products.id"),
        index=True
    )

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True, index=True
    )

    quantity: Mapped[int] = mapped_column(BigInteger, default=0)
    # `price` is the legacy wire/storage alias for sale_price. New clients use
    # the nullable canonical fields; writes keep the alias synchronized.
    price: Mapped[int] = mapped_column(BigInteger, default=0)
    sale_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    purchase_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    media_asset: Mapped["MediaAsset | None"] = relationship()

    @property
    def media_version(self) -> int | None:
        return self.media_asset.version if self.media_asset else None

    @property
    def media_content_sha256(self) -> str | None:
        return self.media_asset.content_sha256 if self.media_asset else None

    @property
    def media_byte_size(self) -> int | None:
        return self.media_asset.byte_size if self.media_asset else None

    @property
    def media_preview_url(self) -> str | None:
        return f"/api/media/{self.media_asset_id}/preview" if self.media_asset_id else None

    @property
    def media_detail_url(self) -> str | None:
        return f"/api/media/{self.media_asset_id}/detail" if self.media_asset_id else None

    is_catalog_backed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        index=True,
    )

    version: Mapped[int] = mapped_column(Integer, default=1)

    custom_label: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True
    )

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    low_stock_threshold: Mapped[int] = mapped_column(BigInteger, default=0)

    low_stock_alert: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    is_hidden: Mapped[bool] = mapped_column(
    Boolean,
    default=False
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        UTC_DATETIME,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)

    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_now,
        onupdate=_now
    )

    owner: Mapped["User"] = relationship(
        back_populates="inventory_items"
    )

    catalog_product: Mapped["CatalogProduct"] = relationship(
        back_populates="inventory_items"
    )

    transactions: Mapped[list["InventoryTransaction"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
        foreign_keys="InventoryTransaction.inventory_item_id",
    )

    labels: Mapped[list["Label"]] = relationship(
        secondary="inventory_item_labels", back_populates="inventory_items"
    )

    barcodes: Mapped[list["ProductBarcode"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
        foreign_keys="ProductBarcode.product_id",
    )

    @property
    def label_ids(self) -> list[int]:
        return [label.id for label in self.labels]

    @property
    def status(self) -> str:
        if self.quantity <= 0:
            return "out_of_stock"

        if (
            self.low_stock_threshold > 0
            and self.quantity <= self.low_stock_threshold
        ):
            return "low_stock"

        return "in_stock"


class ProductBarcode(Base):
    __tablename__ = "product_barcodes"
    __table_args__ = (
        UniqueConstraint("store_id", "value", name="uq_product_barcodes_store_value"),
        UniqueConstraint("id", "store_id", name="uq_product_barcodes_id_store"),
        ForeignKeyConstraint(
            ["inventory_item_id", "store_id"],
            ["inventory_items.id", "inventory_items.store_id"],
            name="fk_product_barcodes_inventory_store",
            ondelete="CASCADE",
        ),
        CheckConstraint("source IN ('manufacturer', 'tanzim')", name="ck_product_barcodes_source"),
        CheckConstraint("meaning IN ('unit', 'package')", name="ck_product_barcodes_meaning"),
        CheckConstraint("scan_quantity > 0", name="ck_product_barcodes_scan_quantity"),
        Index("ix_product_barcodes_store_active_value", "store_id", "is_active", "value"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column("inventory_item_id", ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True)
    value: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(20))
    symbology: Mapped[str] = mapped_column(String(20), default="code128")
    meaning: Mapped[str] = mapped_column(String(20), default="unit")
    scan_quantity: Mapped[int] = mapped_column(BigInteger, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, onupdate=_now)

    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="barcodes", foreign_keys=[product_id]
    )


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        UniqueConstraint(
            "store_id", "actor_user_id", "operation_id",
            name="uq_inventory_movements_store_actor_operation",
        ),
        UniqueConstraint(
            "store_id", "actor_user_id", "reverses_operation_id",
            name="uq_inventory_movements_store_actor_reversal",
        ),
        ForeignKeyConstraint(
            ["product_id", "store_id"],
            ["inventory_items.id", "inventory_items.store_id"],
            name="fk_inventory_movements_product_store",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["barcode_id", "store_id"],
            ["product_barcodes.id", "product_barcodes.store_id"],
            name="fk_inventory_movements_barcode_store",
        ),
        ForeignKeyConstraint(
            ["invoice_id", "store_id"], ["invoices.id", "invoices.store_id"],
            name="fk_inventory_movements_invoice_store", ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["invoice_line_id", "store_id"], ["invoice_lines.id", "invoice_lines.store_id"],
            name="fk_inventory_movements_invoice_line_store", ondelete="RESTRICT",
        ),
        CheckConstraint("kind IN ('receive', 'issue', 'correction', 'reversal')", name="ck_inventory_movements_kind"),
        CheckConstraint("delta <> 0", name="ck_inventory_movements_delta"),
        CheckConstraint("before_quantity >= 0 AND after_quantity >= 0", name="ck_inventory_movements_nonnegative"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    actor_membership_id: Mapped[int] = mapped_column(ForeignKey("store_memberships.id"), index=True)
    operation_id: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(20))
    delta: Mapped[int] = mapped_column(BigInteger)
    correction_quantity: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    scan_source: Mapped[str] = mapped_column(String(20))
    barcode_id: Mapped[int | None] = mapped_column(ForeignKey("product_barcodes.id", ondelete="SET NULL"), nullable=True)
    barcode_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scan_quantity: Mapped[int] = mapped_column(BigInteger, default=1)
    before_quantity: Mapped[int] = mapped_column(BigInteger)
    after_quantity: Mapped[int] = mapped_column(BigInteger)
    reverses_operation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    invoice_id: Mapped[int | None] = mapped_column(ENTITY_ID, nullable=True, index=True)
    invoice_line_id: Mapped[int | None] = mapped_column(ENTITY_ID, nullable=True, index=True)
    client_occurred_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("store_id", "post_operation_id", name="uq_invoices_store_post_operation"),
        UniqueConstraint("store_id", "cancel_operation_id", name="uq_invoices_store_cancel_operation"),
        UniqueConstraint("id", "store_id", name="uq_invoices_id_store"),
        CheckConstraint("invoice_type IN ('purchase', 'sale')", name="ck_invoices_type"),
        CheckConstraint("status IN ('posted', 'cancelled')", name="ck_invoices_status"),
        CheckConstraint("total_amount >= 0", name="ck_invoices_total_nonnegative"),
        Index("ix_invoices_store_posted", "store_id", "posted_at"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    actor_membership_id: Mapped[int] = mapped_column(ForeignKey("store_memberships.id", ondelete="RESTRICT"))
    invoice_type: Mapped[str] = mapped_column(String(12), index=True)
    title: Mapped[str] = mapped_column(String(200))
    counterparty: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="posted", index=True)
    total_amount: Mapped[int] = mapped_column(BigInteger)
    post_operation_id: Mapped[str] = mapped_column(String(64))
    cancel_operation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    posted_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    cancelled_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    cancelled_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    cancelled_by_membership_id: Mapped[int | None] = mapped_column(
        ForeignKey("store_memberships.id", ondelete="RESTRICT"), nullable=True
    )
    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceLine.position"
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    __table_args__ = (
        UniqueConstraint("invoice_id", "product_id", name="uq_invoice_lines_invoice_product"),
        UniqueConstraint("id", "store_id", name="uq_invoice_lines_id_store"),
        ForeignKeyConstraint(
            ["invoice_id", "store_id"], ["invoices.id", "invoices.store_id"],
            name="fk_invoice_lines_invoice_store", ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["product_id", "store_id"], ["inventory_items.id", "inventory_items.store_id"],
            name="fk_invoice_lines_product_store", ondelete="RESTRICT",
        ),
        CheckConstraint("quantity > 0", name="ck_invoice_lines_quantity_positive"),
        CheckConstraint("base_quantity > 0", name="ck_invoice_lines_base_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_invoice_lines_price_nonnegative"),
        CheckConstraint("line_total >= 0", name="ck_invoice_lines_total_nonnegative"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ENTITY_ID, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ENTITY_ID, index=True)
    position: Mapped[int] = mapped_column(Integer)
    product_name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(BigInteger)
    unit: Mapped[str] = mapped_column(String(40))
    pack_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    base_quantity: Mapped[int] = mapped_column(BigInteger)
    unit_price: Mapped[int] = mapped_column(BigInteger)
    line_total: Mapped[int] = mapped_column(BigInteger)
    before_quantity: Mapped[int] = mapped_column(BigInteger)
    after_quantity: Mapped[int] = mapped_column(BigInteger)
    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class SyncOperation(Base):
    __tablename__ = "sync_operations"
    __table_args__ = (
        UniqueConstraint(
            "store_id", "actor_user_id", "operation_id",
            name="uq_sync_store_actor_operation",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    operation_id: Mapped[str] = mapped_column(String(64), index=True)
    request_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    execution_mode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    policy_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)


class SyncChange(Base):
    __tablename__ = "sync_changes"
    __table_args__ = (
        Index("ix_sync_changes_store_cursor", "store_id", "id"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    entity: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[int] = mapped_column(BigInteger, index=True)
    operation: Mapped[str] = mapped_column(String(20))
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        CheckConstraint(
            "price_minor IS NULL OR (price_minor >= 0 AND price_minor % 10 = 0)",
            name="ck_subscription_plans_price_toman_storage",
        ),
        CheckConstraint(
            "(duration IS NULL AND duration_unit IS NULL) OR "
            "(duration > 0 AND duration_unit IN ('day','month','year'))",
            name="ck_subscription_plans_duration_pair",
        ),
        CheckConstraint(
            "NOT is_offer_available OR (id IN ('pro','vip') "
            "AND price_minor IS NOT NULL AND price_minor > 0 "
            "AND duration IS NOT NULL AND duration > 0 "
            "AND duration_unit IS NOT NULL AND duration_unit IN ('day','month','year'))",
            name="ck_subscription_plans_offer_complete",
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="IRR")
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_offer_available: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    features_json: Mapped[str] = mapped_column(Text, default="{}")
    limits_json: Mapped[str] = mapped_column(Text, default="{}")
    policy_revision: Mapped[int] = mapped_column(Integer, default=1)
    commercial_status: Mapped[str] = mapped_column(String(30), default="legacy_unapproved")
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, onupdate=_now)


class StorePlanGrant(Base):
    __tablename__ = "store_plan_grants"
    __table_args__ = (
        UniqueConstraint("request_id", name="uq_store_plan_grants_request"),
        CheckConstraint("ends_at > starts_at", name="ck_store_plan_grants_window"),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    request_id: Mapped[str] = mapped_column(String(64))
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("subscription_plans.id", ondelete="RESTRICT"), index=True)
    source: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(UTC_DATETIME)
    ends_at: Mapped[datetime] = mapped_column(UTC_DATETIME)
    granted_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    revoked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    revocation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # Intentionally not a foreign key: the audit trail must survive target deletion.
    target_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now, index=True)


# ---------- Custom Products ----------
class CustomProduct(Base):
    __tablename__ = "custom_products"

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    quantity: Mapped[int] = mapped_column(BigInteger, default=0)
    price: Mapped[int] = mapped_column(BigInteger, default=0)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)

    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_now,
        onupdate=_now
    )

    owner: Mapped["User"] = relationship(
        back_populates="custom_products"
    )

# ---------- Inventory Transactions ----------
class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["inventory_item_id", "store_id"],
            ["inventory_items.id", "inventory_items.store_id"],
            name="fk_inventory_transactions_inventory_store",
        ),
    )

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[int] = mapped_column(BigInteger, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id"),
        index=True
    )

    type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(BigInteger)

    before_quantity: Mapped[int] = mapped_column(BigInteger)
    after_quantity: Mapped[int] = mapped_column(BigInteger)

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=_now)

    owner: Mapped["User"] = relationship(
        back_populates="transactions"
    )

    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="transactions", foreign_keys=[inventory_item_id]
    )


class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(ENTITY_ID, primary_key=True)

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    # NULL is deliberately interpreted as every existing tool enabled. This
    # keeps pre-migration industries behaviorally unchanged.
    tools_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    catalog_products: Mapped[list["CatalogProduct"]] = relationship(
        back_populates="industry",
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="industry"
    )
