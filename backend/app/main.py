from contextlib import asynccontextmanager
import logging
import re
import time
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from sqlalchemy import text
from .database import engine
from .exceptions import global_exception_handler
from .routers import admin, auth, categories, dashboard, plans, backup, industries, products, inventory, export, transactions, custom_products, catalog_products, sync, labels, personnel, files, media, invoices


logger = logging.getLogger("tanzim.api")
_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


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
async def release_context(request, call_next):
    supplied = request.headers.get("X-Request-ID", "")
    request_id = supplied if _REQUEST_ID.fullmatch(supplied) else uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Tanzim-Build"] = settings.APP_BUILD_ID
    response.headers["X-Tanzim-Schema"] = settings.DATABASE_SCHEMA_VERSION
    if response.status_code >= 400:
        logger.warning(
            "API request failed request_id=%s method=%s path=%s status=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            round((time.perf_counter() - started) * 1000),
        )
    return response


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
    expose_headers=["X-Request-ID", "X-Tanzim-Build", "X-Tanzim-Schema"],
)

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
app.include_router(labels.router, prefix=api)
app.include_router(personnel.router, prefix=api)
app.include_router(files.router, prefix=api)
app.include_router(media.router, prefix=api)
app.include_router(invoices.router, prefix=api)


@app.get("/api/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
        "build_id": settings.APP_BUILD_ID,
        "schema_version": settings.DATABASE_SCHEMA_VERSION,
    }
