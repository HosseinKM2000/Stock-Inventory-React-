from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# =========================================================
# AUTH / USER
# =========================================================
class UserBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=120)


class SignupRequest(UserBase):
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(default=None, min_length=3, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)


class PasswordUpdate(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    username: str
    email: str | None = None
    phone: str | None = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# =========================================================
# CATEGORY
# =========================================================
class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    created_at: datetime


class CategoryWithStats(CategoryOut):
    product_count: int
    total_quantity: int



# =========================================================
# DASHBOARD
# =========================================================
class CategoryBreakdown(BaseModel):
    name: str
    value: int


class DashboardStats(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    inventory_value: int
    category_breakdown: list[CategoryBreakdown]


# =========================================================
# INVENTORY MOVEMENTS
# =========================================================
class InventoryMovementBase(BaseModel):
    type: Literal["stock_in", "stock_out"]
    quantity: int = Field(gt=0)
    reason: str | None = None


class InventoryMovementCreate(InventoryMovementBase):
    product_id: int


class InventoryMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    quantity: int
    reason: str | None = None
    product_id: int
    user_id: int
    created_at: datetime


# =========================================================
# TRANSACTIONS
# =========================================================
class TransactionCreate(BaseModel):
    type: Literal["stock_in", "stock_out"]
    quantity: int = Field(gt=0)
    note: str | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    type: str
    quantity: int
    note: str | None = None
    created_at: datetime


# =========================================================
# CATALOG PRODUCTS (shared products)
# =========================================================
class CatalogProductBase(BaseModel):
    name: str
    description: str | None = None
    brand: str | None = None
    image_url: str | None = None


# =========================================================
# USER INVENTORY (new system)
# =========================================================
class InventoryCreate(BaseModel):
    product_catalog_id: int
    custom_label: str | None = None
    note: str | None = None
    quantity: int = Field(default=0, ge=0)
    price: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=0, ge=0)
    low_stock_alert: bool = False


class InventoryUpdate(BaseModel):
    custom_label: str | None = None
    note: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    price: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    low_stock_alert: bool | None = None

class CatalogProductOut(CatalogProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    
class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quantity: int
    price: int
    custom_label: str | None = None
    note: str | None = None
    low_stock_threshold: int
    low_stock_alert: bool
    status: str
    created_at: datetime
    updated_at: datetime
    catalog_product: CatalogProductOut

class InventoryItemOut(BaseModel):
    id: int
    quantity: int
    price: int
    custom_label: str | None
    note: str | None
    low_stock_threshold: int
    low_stock_alert: bool
    status: str
    catalog_product: CatalogProductOut



# =========================================================
# CUSTOM PRODUCTS
# =========================================================
class CustomProductCreate(BaseModel):
    name: str
    description: str | None = None
    image_url: str | None = None
    quantity: int = Field(default=0, ge=0)
    price: int = Field(default=0, ge=0)
    note: str | None = None


class CustomProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    image_url: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    price: int | None = Field(default=None, ge=0)
    note: str | None = None


class CustomProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    image_url: str | None = None
    quantity: int
    price: int
    note: str | None = None
    created_at: datetime
    updated_at: datetime


# =========================================================
# PRODUCT (OLD SYSTEM - compatibility)
# =========================================================
class PaginatedProducts(BaseModel):
    items: list[InventoryOut]
    total: int
    page: int
    limit: int


class InventoryStats(BaseModel):
    total_items: int
    total_quantity: int
    inventory_value: int

    low_stock_count: int
    out_of_stock_count: int

    cheapest: InventoryOut | None = None
    most_expensive: InventoryOut | None = None