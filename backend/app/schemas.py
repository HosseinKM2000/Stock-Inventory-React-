from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictInt, field_validator, model_validator


# =========================================================
# AUTH / USER
# =========================================================
class UserBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=120)


class SignupRequest(UserBase):
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    device_fingerprint: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("PASSWORD_TOO_LONG")
        return value


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
        if len(value.encode("utf-8")) > 72:
            raise ValueError("PASSWORD_TOO_LONG")
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
    store_id: int | None = None
    membership_id: int | None = None
    store_role_id: int | None = None
    store_role_name: str | None = None
    store_permissions: list[str] = Field(default_factory=list)
    is_store_owner: bool = False
    temporary_password_required: bool = False
    credentials_notice_viewed: bool = True
    membership_authorization_checked_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class StoreRoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    permissions: list[str] = Field(default_factory=list)


class StoreRoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    permissions: list[str] | None = None


class StoreRoleOut(BaseModel):
    id: int
    name: str
    permissions: list[str]
    assigned_count: int = 0


class PersonnelCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    username: str | None = Field(default=None, min_length=3, max_length=120)
    role_id: int


class PersonnelUpdate(BaseModel):
    role_id: int | None = None
    active: bool | None = None


class PersonnelOut(BaseModel):
    membership_id: int
    user_id: int
    first_name: str
    last_name: str
    username: str
    role_id: int
    role_name: str
    active: bool
    temporary_password_required: bool
    credentials_notice_viewed: bool
    created_at: datetime
    last_activity_at: datetime | None = None


class PersonnelCreated(PersonnelOut):
    temporary_password: str


class PersonnelCapacityOut(BaseModel):
    enabled: bool
    used: int
    limit: int
    available: int


class ActivityOut(BaseModel):
    id: int
    actor_user_id: int
    actor_membership_id: int
    actor_display_name: str
    actor_role_name: str
    operation_id: str
    target_entity: str
    target_id: str | None
    action: str
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    outcome: str
    client_occurred_at: datetime | None
    accepted_at: datetime


class ActivityPage(BaseModel):
    items: list[ActivityOut]
    total: int
    page: int
    page_size: int


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


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    normalized_name: str
    version: int = 1
    created_at: datetime
    updated_at: datetime


# =========================================================
# CATALOG
# =========================================================
class CatalogProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    brand: str | None = Field(default=None, max_length=120)
    image_url: str | None = Field(default=None, max_length=500)
    is_packaged: bool = False
    pack_size: StrictInt | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_packaging(self):
        if not self.is_packaged:
            self.pack_size = None
        elif self.pack_size is None:
            raise ValueError("PACK_SIZE_REQUIRED")
        return self

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
    is_packaged: bool | None = None
    pack_size: StrictInt | None = Field(default=None, ge=1)

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

    is_active: bool

    name: str

    description: str | None

    brand: str | None

    image_url: str | None

    is_packaged: bool

    pack_size: int | None

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
    label_ids: list[int] = []
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
    entity: Literal["product", "category", "label"]
    entity_id: int
    operation: Literal["CREATE", "UPDATE", "DELETE"]
    payload: dict[str, Any] | None = None
    base_version: int | None = Field(default=None, ge=1)
    client_occurred_at: datetime | None = None


class SyncBatchRequest(BaseModel):
    operations: list[SyncOperationIn] = Field(max_length=200)


class SyncOperationResult(BaseModel):
    operation_id: str
    status: Literal["applied", "conflict", "fatal_error"]
    entity_id: int
    record: dict[str, Any] | InventoryOut | None = None
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
    user_id: int
    plan: str
    label: str
    status: Literal["active", "expired"]
    account_status: Literal["active"]
    started_at: datetime | None = None
    expires_at: datetime | None = None
    server_time: datetime
    synced_at: datetime
    capabilities: dict[str, bool]
    limits: dict[str, int | None]
    tools: dict[str, bool]


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

    @field_validator("limits")
    @classmethod
    def validate_limits(cls, value):
        if any(item is not None and (isinstance(item, bool) or item < 1) for item in value.values()):
            raise ValueError("PLAN_LIMIT_INVALID")
        return value


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

    @field_validator("limits")
    @classmethod
    def validate_optional_limits(cls, value):
        if value is not None and any(item is not None and (isinstance(item, bool) or item < 1) for item in value.values()):
            raise ValueError("PLAN_LIMIT_INVALID")
        return value


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
    device_limit_mode: Literal["inherit", "unlimited", "limited"]
    device_limit_override: int | None = None
    effective_device_limit: int | None = None
    device_limit_source: Literal["plan", "user"]
    active_session_count: int = 0


class AdminDevicePolicyUpdate(BaseModel):
    mode: Literal["inherit", "unlimited", "limited"]
    limit: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_policy(self):
        if (self.mode == "limited") != (self.limit is not None):
            raise ValueError("DEVICE_POLICY_INVALID")
        return self
    

class DeviceInfo(BaseModel):
    device_fingerprint: str

class IndustryBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("name")
    @classmethod
    def normalize_industry_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("INDUSTRY_NAME_REQUIRED")
        return value


class IndustryCreate(IndustryBase):
    is_active: bool = True
    tools: dict[str, bool] | None = None

    @field_validator("tools")
    @classmethod
    def validate_tools(cls, value):
        if value is not None and set(value) - {"import", "labels", "categories", "export", "catalog", "recovery"}:
            raise ValueError("UNKNOWN_TOOL_ID")
        return value


class IndustryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None
    description: str | None = Field(default=None, max_length=5000)
    tools: dict[str, bool] | None = None

    @field_validator("tools")
    @classmethod
    def validate_tools(cls, value):
        if value is not None and set(value) - {"import", "labels", "categories", "export", "catalog", "recovery"}:
            raise ValueError("UNKNOWN_TOOL_ID")
        return value

    @field_validator("name")
    @classmethod
    def normalize_industry_update_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("INDUSTRY_NAME_REQUIRED")
        return value


class IndustryOut(IndustryBase):
    id: int
    is_active: bool
    tools: dict[str, bool]

    model_config = ConfigDict(from_attributes=True)

