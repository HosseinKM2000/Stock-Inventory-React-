from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Auth / User ----------
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


# ---------- Category ----------
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


# ---------- Product ----------
class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    unit: str | None = None
    quantity: int
    price: int
    low_stock_threshold: int
    low_stock_alert: bool
    image_url: str | None = None
    category_id: int | None = None
    status: str
    created_at: datetime
    updated_at: datetime

class PaginatedProducts(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    limit: int


# ---------- Dashboard ----------
class CategoryBreakdown(BaseModel):
    name: str
    value: int


class DashboardStats(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    inventory_value: int
    category_breakdown: list[CategoryBreakdown]


# ---------- Inventory ----------
class InventoryMovementBase(BaseModel):
    type: str
    quantity: int = Field(gt=0)
    reason: str | None = None


class InventoryMovementCreate(InventoryMovementBase):
    product_id: int


class InventoryMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    quantity: int
    reason: str | None
    product_id: int
    user_id: int
    created_at: datetime


class ProductStats(BaseModel):
    total_products: int
    total_quantity: int
    inventory_value: int
    low_stock_count: int
    out_of_stock_count: int
    cheapest: ProductOut | None = None
    most_expensive: ProductOut | None = None

class CategoryWithStats(CategoryOut):
    product_count: int
    total_quantity: int

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
    note: str | None
    created_at: datetime