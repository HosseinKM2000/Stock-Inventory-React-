# Tanzim

Offline-first inventory management built with React, TypeScript, Vite,
TanStack Router/Query, Radix Themes, FastAPI, SQLAlchemy, and SQLite.

## Running the full stack

### Windows quick start

After installing the frontend and backend dependencies, double-click
`run-dev.bat`, or run:

```bat
run-dev.bat
```

It starts the API at `http://localhost:8000` and the frontend at
`http://localhost:5173` in separate windows. Validate prerequisites without
starting either process with:

```bat
run-dev.bat --check
```

### Manual start

Backend setup is documented in [`backend/README.md`](backend/README.md).

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
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
data, administration, server backup, and idempotent/version-aware sync.

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

## Verification

```bash
npm run lint
npm run build
cd backend
python -m unittest discover -s tests -v
```
