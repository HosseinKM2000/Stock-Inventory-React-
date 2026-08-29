
import enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- User ----------
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120))

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
        DateTime, nullable=True
    )
    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("industries.id"),
        nullable=True,
        index=True,
    )

    industry: Mapped["Industry | None"] = relationship(
    back_populates="users"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now
    )

    categories: Mapped[list["Category"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan"
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


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)

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
        DateTime,
        default=_now,
    )

    last_seen: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now,
        onupdate=_now,
    )

    user: Mapped["User"] = relationship(
        back_populates="sessions",
    )


# ---------- Category ----------
class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now
    )

    owner: Mapped["User"] = relationship(back_populates="categories")


# ---------- Shared Catalog ----------
class CatalogProduct(Base):
    __tablename__ = "catalog_products"

    id: Mapped[int] = mapped_column(primary_key=True)

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
        DateTime,
        default=_now,
    )

    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        back_populates="catalog_product"
    )

# ---------- User Inventory ----------
class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)

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

    quantity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[int] = mapped_column(Integer, default=0)

    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

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

    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=0)

    low_stock_alert: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    is_hidden: Mapped[bool] = mapped_column(
    Boolean,
    default=False
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
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
        cascade="all, delete-orphan"
    )

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


class SyncOperation(Base):
    __tablename__ = "sync_operations"
    __table_args__ = (
        UniqueConstraint("user_id", "operation_id", name="uq_sync_user_operation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    operation_id: Mapped[str] = mapped_column(String(64), index=True)
    result_payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SyncChange(Base):
    __tablename__ = "sync_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    entity: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    operation: Mapped[str] = mapped_column(String(20))
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="IRR")
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    features_json: Mapped[str] = mapped_column(Text, default="{}")
    limits_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # Intentionally not a foreign key: the audit trail must survive target deletion.
    target_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)


# ---------- Custom Products ----------
class CustomProduct(Base):
    __tablename__ = "custom_products"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    quantity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[int] = mapped_column(Integer, default=0)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now,
        onupdate=_now
    )

    owner: Mapped["User"] = relationship(
        back_populates="custom_products"
    )

# ---------- Inventory Transactions ----------
class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id"),
        index=True
    )

    type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer)

    before_quantity: Mapped[int] = mapped_column(Integer)
    after_quantity: Mapped[int] = mapped_column(Integer)

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    owner: Mapped["User"] = relationship(
        back_populates="transactions"
    )

    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="transactions"
    )


class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(primary_key=True)

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

    catalog_products: Mapped[list["CatalogProduct"]] = relationship(
        back_populates="industry",
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="industry"
    )
