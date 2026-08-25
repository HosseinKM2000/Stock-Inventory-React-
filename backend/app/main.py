from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from sqlalchemy import inspect, text
from .database import Base, engine
from .database import SessionLocal
from .exceptions import global_exception_handler
from .routers import admin, auth, categories, dashboard, plans, backup, industries, products, inventory, export, transactions, custom_products, catalog_products, sync
from .services.bootstrap_service import ensure_system_admin
from .services.subscription_service import seed_default_plans

# Create tables on startup (simple approach; swap for Alembic if needed).
Base.metadata.create_all(bind=engine)


def _apply_compatibility_migrations() -> None:
    """Additive migration for installations created before offline sync."""
    inventory_columns = {column["name"] for column in inspect(engine).get_columns("inventory_items")}
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    category_columns = {column["name"] for column in inspect(engine).get_columns("categories")}

    with engine.begin() as connection:
        if "image_url" not in inventory_columns:
            connection.execute(text("ALTER TABLE inventory_items ADD COLUMN image_url VARCHAR(500)"))
        if "version" not in inventory_columns:
            connection.execute(
                text("ALTER TABLE inventory_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1")
            )
        if "category_id" not in inventory_columns:
            connection.execute(text("ALTER TABLE inventory_items ADD COLUMN category_id INTEGER"))
        if "is_active" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
        if "is_admin" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
        if "subscription_expires_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME"))
        if "subscription_started_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN subscription_started_at DATETIME"))
        if "role" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER'"))
            connection.execute(text("UPDATE users SET role = 'ADMIN' WHERE is_admin = 1"))
        if "is_system_admin" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_system_admin BOOLEAN NOT NULL DEFAULT 0"))
        if "system_key" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN system_key VARCHAR(80)"))
        if "updated_at" not in category_columns:
            connection.execute(text("ALTER TABLE categories ADD COLUMN updated_at DATETIME"))
            connection.execute(text("UPDATE categories SET updated_at = created_at WHERE updated_at IS NULL"))


_apply_compatibility_migrations()

with SessionLocal() as bootstrap_db:
    seed_default_plans(bootstrap_db)
    ensure_system_admin(bootstrap_db)

app = FastAPI(title="Tanzim API", version="1.0.0")
app.add_exception_handler(Exception, global_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

api = "/api"
app.include_router(auth.router, prefix=api)
app.include_router(plans.router, prefix=api)
app.include_router(admin.router, prefix=api)
app.include_router(categories.router, prefix=api)
app.include_router(products.router, prefix=api)
app.include_router(dashboard.router, prefix=api)
app.include_router(inventory.router, prefix=api)
app.include_router(export.router, prefix=api)
app.include_router(transactions.router, prefix=api)
app.include_router(custom_products.router, prefix=api)
app.include_router(backup.router, prefix=api)
app.include_router(industries.router, prefix=api)
app.include_router(catalog_products.router, prefix=api)
app.include_router(sync.router, prefix=api)


@app.get("/api/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected"
    }
