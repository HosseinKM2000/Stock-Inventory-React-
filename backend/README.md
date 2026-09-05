# Tanzim — Backend (FastAPI + PostgreSQL)

REST API for Tanzim: JWT auth, product/category CRUD with image upload,
dashboard statistics, subscriptions, administration, and offline synchronization.
Server persistence uses PostgreSQL 18.6; client IndexedDB and OPFS remain local.

## Requirements

- Python 3.10+
- Docker Desktop with Docker Compose

## Setup and run

From the repository root:

```powershell
Copy-Item .env.example .env
# Edit .env and replace every change-me placeholder.

py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

docker compose up -d --wait postgres

Set-Location backend
.venv\Scripts\python.exe -m alembic upgrade head

# Supply the established permanent administrator password without writing it
# to a file. Re-running this command never changes an existing admin password.
$env:SYSTEM_ADMIN_PASSWORD = Read-Host "Administrator password"
.venv\Scripts\python.exe -m app.bootstrap_admin
Remove-Item Env:SYSTEM_ADMIN_PASSWORD

.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The API is served at `http://localhost:8000`.

- Interactive docs (Swagger UI): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`
- Uploaded product images are served from `http://localhost:8000/uploads/...`

The backend intentionally fails when `DATABASE_URL` is absent or PostgreSQL is
unavailable. Schema changes are explicit Alembic migrations; application startup
never creates, alters, drops, or seeds database objects.

## Configuration

Set via environment variables or a `.env` file (see `.env.example`):

| Variable | Default | Description |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Set to `production` for production; startup then rejects the development signing key |
| `SECRET_KEY` | `dev-secret-change-me` | JWT signing key — **change in production** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Access-token lifetime |
| `DATABASE_URL` | required | `postgresql+psycopg://...` SQLAlchemy URL; credentials must be environment supplied |
| `CORS_ORIGINS` | localhost 5173/5174 | Comma-separated allowed frontend origins |
| `SYSTEM_ADMIN_PASSWORD` | unset | One-time seed secret for the immutable system administrator; remove it after running the seed |

## Account, RBAC, and subscription controls

- User access can be disabled globally; disabled accounts are rejected with `423 ACCOUNT_DISABLED`.
- Roles and permissions are enforced centrally by the authorization service. The legacy `is_admin` field remains synchronized for compatibility.
- Subscription plans, capabilities, pricing metadata, durations, and limits are persisted and exposed by `GET /api/plans/current`.
- Paid-plan expiration is server enforced. Expired accounts retain reads while inventory/category writes are rejected.
- Admin user, role, subscription, plan, subscriber, and audit operations live under `/api/admin` and require the `ADMIN` role.
- The permanent system administrator is identified by a stable system key and cannot be disabled, deleted, or demoted. `SYSTEM_ADMIN_PASSWORD` must contain at least 12 characters when the account is first seeded.
- Re-running the seed preserves the existing password and ensures exactly one protected system administrator.
- Built-in subscription plans are idempotent reference data created by the same explicit seed command.

For an explicit one-time bootstrap from `backend/` in PowerShell:

```powershell
$env:SYSTEM_ADMIN_PASSWORD = Read-Host "Temporary bootstrap password"
python -m app.bootstrap_admin
Remove-Item Env:SYSTEM_ADMIN_PASSWORD
```

## API overview

All routes are under `/api`. Authenticated routes require an
`Authorization: Bearer <token>` header (obtained from signup/login).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | – | Create account, returns token + user |
| POST | `/api/auth/login` | – | Log in, returns token + user |
| GET | `/api/auth/me` | ✓ | Current user |
| PATCH | `/api/auth/me` | ✓ | Update profile |
| PATCH | `/api/auth/me/password` | ✓ | Change password |
| GET | `/api/plans/current` | ✓ | Current timestamp-based entitlement |
| POST | `/api/sync/batch` | ✓ | Idempotent local product change batch |
| GET | `/api/sync/changes` | ✓ | Incremental product changes/tombstones |
| GET | `/api/categories` | ✓ | List categories |
| POST | `/api/categories` | ✓ | Create category |
| PATCH | `/api/categories/{id}` | ✓ | Update category |
| DELETE | `/api/categories/{id}` | ✓ | Delete category |
| GET | `/api/products` | ✓ | List (supports `search`, `sort`, `category_id`) |
| GET | `/api/products/{id}` | ✓ | Get one product |
| POST | `/api/products` | ✓ | Create (multipart, optional `image`) |
| PATCH | `/api/products/{id}` | ✓ | Update (multipart) |
| DELETE | `/api/products/{id}` | ✓ | Delete |
| GET | `/api/dashboard/stats` | ✓ | Totals, low/out-of-stock counts, value, breakdown |
| GET | `/api/catalog-products` | ✓ | Active shared catalog |
| PATCH | `/api/catalog-products/{id}/archive` | Admin | Archive catalog product |
| PATCH | `/api/catalog-products/{id}/restore` | Admin | Restore catalog product |
| DELETE | `/api/catalog-products/{id}` | Admin | Transactional permanent deletion |
| GET/PATCH/DELETE | `/api/admin/*` | Admin | Users, plans, subscriptions, and audit |

Product `status` (`in_stock` / `low_stock` / `out_of_stock`) is derived
server-side from `quantity` and `low_stock_threshold`.

## Database operations

Run these commands from the repository root unless noted:

```powershell
docker compose up -d --wait postgres
docker compose stop postgres
docker compose down

Set-Location backend
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m alembic current
.venv\Scripts\python.exe -m alembic heads
```

`docker compose down` preserves the named database volume. Do not add `--volumes`
unless intentional permanent deletion of the local PostgreSQL data is required.

## Project structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app, database readiness, CORS, routers
│   ├── config.py        # settings + minimal .env loader
│   ├── database.py      # PostgreSQL SQLAlchemy engine/session
│   ├── models.py        # User, Category, Product
│   ├── schemas.py       # Pydantic request/response models
│   ├── security.py      # bcrypt hashing + JWT
│   ├── deps.py          # auth dependency (current user)
│   └── routers/         # auth, categories, products, dashboard
├── alembic/             # Versioned database schema
├── alembic.ini
└── requirements.txt
```
