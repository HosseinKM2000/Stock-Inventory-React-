from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from sqlalchemy import text
from .database import engine
from .exceptions import global_exception_handler
from .routers import admin, auth, categories, dashboard, plans, backup, industries, products, inventory, export, transactions, custom_products, catalog_products, sync


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Establish the configured database connection during startup. A missing or
    # unavailable PostgreSQL database must fail loudly rather than surfacing on
    # the first user request or falling back to another engine.
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    yield


app = FastAPI(title="Tanzim API", version="1.0.0", lifespan=lifespan)
app.add_exception_handler(Exception, global_exception_handler)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
    )
    return response

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
