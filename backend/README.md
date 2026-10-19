# Stock Inventory — Backend (FastAPI + SQLite)

REST API for the Stock Inventory app: JWT auth, product/category CRUD with
image upload, and dashboard statistics. Data is stored in a local SQLite file.

## Requirements

- Python 3.10+

## Setup & run

From the `backend/` directory:

```bash
# 1. Create and activate a virtual environment
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Windows (Git Bash)
source .venv/Scripts/activate
# macOS / Linux
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. (optional) configure environment
cp .env.example .env   # then edit values; sensible dev defaults are used otherwise

# 4. Run the dev server (auto-reload)
uvicorn app.main:app --reload --port 8000
```

The API is served at `http://localhost:8000`.

- Interactive docs (Swagger UI): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`
- Uploaded product images are served from `http://localhost:8000/uploads/...`

The SQLite database (`stock_inventory.db`) and the `uploads/` folder are created
automatically on first run. Tables are created on startup — no migration step.

## Configuration

Set via environment variables or a `.env` file (see `.env.example`):

| Variable | Default | Description |
| --- | --- | --- |
| `SECRET_KEY` | `dev-secret-change-me` | JWT signing key — **change in production** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Access-token lifetime |
| `DATABASE_URL` | `sqlite:///./stock_inventory.db` | SQLAlchemy database URL |
| `CORS_ORIGINS` | localhost 5173/5174 | Comma-separated allowed frontend origins |

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

Product `status` (`in_stock` / `low_stock` / `out_of_stock`) is derived
server-side from `quantity` and `low_stock_threshold`.

## Project structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app, CORS, static uploads, routers
│   ├── config.py        # settings + minimal .env loader
│   ├── database.py      # SQLAlchemy engine/session
│   ├── models.py        # User, Category, Product
│   ├── schemas.py       # Pydantic request/response models
│   ├── security.py      # bcrypt hashing + JWT
│   ├── deps.py          # auth dependency (current user)
│   └── routers/         # auth, categories, products, dashboard
└── requirements.txt
```
