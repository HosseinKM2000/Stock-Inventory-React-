from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# =========================================================
# AUTH / USER
# =========================================================
class UserBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=120)


class SignupRequest(UserBase):
    phone: str | None = None
    device_fingerprint: str
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str
    device_fingerprint: str


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(default=None, min_length=3, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)


class PasswordUpdate(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class IndustrySelect(BaseModel):
    industry_id: int

class IndustrySimpleOut(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(
        from_attributes=True
    )

class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    username: str
    email: str | None = None
    phone: str | None = None
    plan: str
    industry_id: int | None = None
    created_at: datetime
    industry: IndustrySimpleOut | None = None

    model_config = ConfigDict(from_attributes=True)

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
# CATALOG
# =========================================================
class CatalogProductBase(BaseModel):
    name: str
    description: str | None = None
    brand: str | None = None
    image_url: str | None = None

class CatalogProductCreate(CatalogProductBase):
    industry_id: int

    name: str

    description: str | None = None

    brand: str | None = None

    image_url: str | None = None


class CatalogProductUpdate(BaseModel):
    industry_id: int | None = None

    name: str | None = None

    description: str | None = None

    brand: str | None = None

    image_url: str | None = None


class CatalogProductOut(BaseModel):
    id: int

    industry_id: int

    name: str

    description: str | None

    brand: str | None

    image_url: str | None

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# INVENTORY
# =========================================================
class InventoryCreate(BaseModel):
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


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quantity: int
    price: int

    custom_label: str | None = None
    note: str | None = None

    low_stock_threshold: int
    low_stock_alert: bool

    is_hidden: bool
    deleted_at: datetime | None = None

    status: str

    created_at: datetime
    updated_at: datetime

    catalog_product: CatalogProductOut


class InventoryMeta(BaseModel):
    page: int
    limit: int
    total: int


class InventoryListResponse(BaseModel):
    items: list[InventoryOut]
    meta: InventoryMeta

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
    inventory_item_id: int
    type: str
    quantity: int
    before_quantity: int
    after_quantity: int
    note: str | None = None
    created_at: datetime


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
# DASHBOARD
# =========================================================
class DashboardStats(BaseModel):
    total_products: int

    hidden_products: int

    deleted_products: int

    inventory_value: int

    low_stock: int

    out_of_stock: int


class InventoryStats(BaseModel):
    total_items: int
    total_quantity: int
    inventory_value: int
    low_stock_count: int
    out_of_stock_count: int
    cheapest_price: int | None = None
    most_expensive_price: int | None = None


# =========================================================
# PAGINATION
# =========================================================
class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int


class PaginatedInventory(BaseModel):
    items: list[InventoryOut]
    meta: PaginationMeta


class PaginatedCatalog(BaseModel):
    items: list[CatalogProductOut]
    meta: PaginationMeta


# =========================================================
# BULK SYNC (offline -> online)
# =========================================================
class InventorySyncItem(BaseModel):
    id: int
    quantity: int
    price: int
    custom_label: str | None = None
    note: str | None = None


class InventoryBulkSync(BaseModel):
    items: list[InventorySyncItem]


# =========================================================
# GENERIC RESPONSES
# =========================================================
class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None


class MessageResponse(BaseModel):
    success: bool = True
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    detail: str

# =========================================================
# PLAN
# =========================================================
class PlanUpdate(BaseModel):
    plan: Literal["free", "starter", "pro", "vip"]
    

class DeviceInfo(BaseModel):
    device_fingerprint: str

class IndustryBase(BaseModel):
    name: str
    description: str | None = None


class IndustryCreate(IndustryBase):
    is_active: bool = True
    pass


class IndustryUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    description: str | None = None


class IndustryOut(IndustryBase):
    id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

