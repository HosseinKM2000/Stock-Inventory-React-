from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from sqlalchemy import text
from .database import Base, engine
from .exceptions import global_exception_handler
from .routers import auth, bale, categories, dashboard, plans, backup, products, inventory, export, transactions, catalog, custom_products, backup, industries

# Create tables on startup (simple approach; swap for Alembic if needed).
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Inventory API", version="1.0.0")
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
app.include_router(bale.router, prefix=api)
app.include_router(plans.router, prefix=api)
app.include_router(categories.router, prefix=api)
app.include_router(products.router, prefix=api)
app.include_router(dashboard.router, prefix=api)
app.include_router(inventory.router, prefix=api)
app.include_router(export.router, prefix=api)
app.include_router(transactions.router, prefix=api)
app.include_router(catalog.router, prefix=api)
app.include_router(custom_products.router, prefix=api)
app.include_router(backup.router, prefix=api)
app.include_router(industries.router, prefix=api)


@app.get("/api/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected"
    }
