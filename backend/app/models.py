from datetime import datetime, timezone

import enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    industry: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True
    )

    device_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True
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

    owner: Mapped["User"] = relationship(back_populates="categories")


# ---------- Shared Catalog ----------
class CatalogProduct(Base):
    __tablename__ = "catalog_products"

    id: Mapped[int] = mapped_column(primary_key=True)

    industry: Mapped[str] = mapped_column(
    String(120),
    index=True
    )

    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

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

    quantity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[int] = mapped_column(Integer, default=0)

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
