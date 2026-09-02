# Tanzim

Offline-first inventory management built with React, TypeScript, Vite,
TanStack Router/Query, Radix Themes, FastAPI, SQLAlchemy, and PostgreSQL.

## Running the full stack

### Windows quick start

Copy `.env.example` to `.env`, replace every `change-me` value, install the
frontend/backend dependencies, and seed the administrator once as documented in
[`backend/README.md`](backend/README.md). Then double-click `run-dev.bat`, or run:

```bat
run-dev.bat
```

It starts PostgreSQL 18.6, applies Alembic migrations, and opens the API at
`http://localhost:8000` and frontend at `http://localhost:5173` in separate
windows. Validate prerequisites without starting either process with:

```bat
run-dev.bat --check
```

### PostgreSQL and manual start

Backend setup is documented in [`backend/README.md`](backend/README.md).

```powershell
Copy-Item .env.example .env
# Replace the placeholder secrets in .env.
docker compose up -d --wait postgres

Set-Location backend
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

In another terminal, from the repository root:

```bash
npm install
npm run dev
```

Set `VITE_API_URL` when the API is not available at the default
`http://localhost:8000/api`.

## Architecture

IndexedDB is the operational store for products, categories, the durable
outbox, and sync cursors. Product images are processed in the browser and
stored in OPFS. FastAPI provides authentication, subscriptions, shared catalog
data, administration, server backup, and idempotent/version-aware sync backed
by PostgreSQL. PostgreSQL does not replace browser-side IndexedDB or OPFS.

Normal inventory work does not require a live request. Local changes are queued
and synchronized on startup, reconnection, focus, visibility changes, and—when
the browser supports it—Background Sync.

Subscription permissions are cached as a user-bound offline entitlement after
successful server verification. Absolute expiration is evaluated locally from
the server-time baseline, and reconnecting verifies the account and entitlement
before synchronization resumes. Expiration or account disablement changes
access only: IndexedDB data, OPFS images, and queued operations are not deleted.
The backend remains the ultimate authority; browser-side clock checks provide
reasonable offline enforcement, not DRM-grade protection on a user-controlled
device.

Optional product packaging is catalog metadata (`is_packaged` and `pack_size`).
Stock `quantity`, price calculations, thresholds, transactions, and dashboard
statistics always remain individual-unit based. Package counts and remainders
are derived in the client, and pack-mode stock actions are converted back to
unit deltas before entering the existing local outbox.

## Verification

```bash
npm run lint
npm run build
cd backend
python -m unittest discover -s tests -v
```
