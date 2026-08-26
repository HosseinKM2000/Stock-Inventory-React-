from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not any(character.isupper() for character in value):
            raise ValueError("PASSWORD_UPPERCASE_REQUIRED")
        if not any(character.islower() for character in value):
            raise ValueError("PASSWORD_LOWERCASE_REQUIRED")
        if not any(character.isdigit() for character in value):
            raise ValueError("PASSWORD_NUMBER_REQUIRED")
        return value


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
    is_active: bool
    is_admin: bool
    role: Literal["USER", "ADMIN"]
    is_system_admin: bool
    subscription_started_at: datetime | None = None
    subscription_expires_at: datetime | None = None
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
    id: int | None = Field(default=None, gt=0)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class CategoryWithStats(CategoryOut):
    product_count: int
    total_quantity: int


# =========================================================
# CATALOG
# =========================================================
class CatalogProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    brand: str | None = Field(default=None, max_length=120)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("CATALOG_NAME_REQUIRED")
        return value

    @field_validator("description", "brand", "image_url")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        return value

class CatalogProductCreate(CatalogProductBase):
    industry_id: int = Field(gt=0)


class CatalogProductUpdate(BaseModel):
    industry_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    brand: str | None = Field(default=None, max_length=120)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("CATALOG_NAME_REQUIRED")
        return value

    @field_validator("description", "brand", "image_url")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

class CatalogProductOut(BaseModel):
    id: int

    industry_id: int

    name: str

    description: str | None

    brand: str | None

    image_url: str | None

    created_at: datetime

    industry: IndustrySimpleOut

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
    catalog_product_id: int
    is_catalog_backed: bool = False
    category_id: int | None = None
    quantity: int
    price: int

    image_url: str | None = None
    version: int = 1

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


class SyncOperationIn(BaseModel):
    operation_id: str = Field(min_length=1, max_length=64)
    entity: Literal["product"]
    entity_id: int
    operation: Literal["CREATE", "UPDATE", "DELETE"]
    payload: dict[str, Any] | None = None
    base_version: int | None = Field(default=None, ge=1)


class SyncBatchRequest(BaseModel):
    operations: list[SyncOperationIn] = Field(max_length=200)


class SyncOperationResult(BaseModel):
    operation_id: str
    status: Literal["applied", "conflict", "fatal_error"]
    entity_id: int
    record: InventoryOut | None = None
    error: str | None = None


class SyncBatchResponse(BaseModel):
    results: list[SyncOperationResult]
    cursor: int


class SyncChangeOut(BaseModel):
    cursor: int
    entity: Literal["product"]
    entity_id: int
    operation: Literal["UPSERT", "DELETE"]
    record: InventoryOut | None = None


class SyncChangesResponse(BaseModel):
    cursor: int
    changes: list[SyncChangeOut]


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
class EntitlementOut(BaseModel):
    plan: str
    label: str
    status: Literal["active", "expired"]
    started_at: datetime | None = None
    expires_at: datetime | None = None
    synced_at: datetime
    capabilities: dict[str, bool]
    limits: dict[str, int | None]


class PlanDefinitionOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    price_minor: int | None = None
    currency: str
    duration: int | None = None
    duration_unit: Literal["day", "month", "year"] | None = None
    is_active: bool
    features: dict[str, bool]
    limits: dict[str, int | None]
    created_at: datetime

    updated_at: datetime


class PlanCreate(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9_-]+$", min_length=2, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    price_minor: int | None = Field(default=None, ge=0)
    currency: str = Field(default="IRR", min_length=3, max_length=10)
    duration: int | None = Field(default=None, gt=0)
    duration_unit: Literal["day", "month", "year"] | None = None
    is_active: bool = True
    features: dict[str, bool]
    limits: dict[str, int | None]


class PlanPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    price_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=10)
    duration: int | None = Field(default=None, gt=0)
    duration_unit: Literal["day", "month", "year"] | None = None
    is_active: bool | None = None
    features: dict[str, bool] | None = None
    limits: dict[str, int | None] | None = None


class AdminUserStateUpdate(BaseModel):
    is_active: bool


class AdminUserRoleUpdate(BaseModel):
    role: Literal["USER", "ADMIN"]


class AdminSubscriptionUpdate(BaseModel):
    plan: str
    subscription_started_at: datetime | None = None
    subscription_expires_at: datetime | None = None


class AdminUserOut(UserOut):
    subscription_status: Literal["active", "expired"]
    last_activity_at: datetime | None = None
    remaining_days: int | None = None
    

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

