# Automated testing

## Install

```powershell
npm.cmd install
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
```

No suite reads production credentials. The fast backend suite generates a
temporary SQLite file strictly for API compatibility tests. PostgreSQL tests
require an explicit disposable database.

## Commands

From the repository root:

```powershell
# Frontend
npm.cmd run test:unit
npm.cmd run test:component
npm.cmd run test:typecheck
npm.cmd test
npm.cmd run test:coverage

# Backend fast/unit and existing API compatibility tests
npm.cmd run test:backend

# Or, from backend directly
Set-Location backend
.venv\Scripts\python.exe -m pytest tests --ignore=tests/test_postgresql.py

# Backend coverage
.venv\Scripts\python.exe -m pytest tests --ignore=tests/test_postgresql.py `
  --cov=app --cov-report=term-missing --cov-report=html:coverage
```

### Isolated PostgreSQL integration

Create a disposable database whose name contains `test`, then provide its full
URL explicitly. The suite drops and recreates the `public` schema in that
database, runs Alembic to head, validates the schema and PostgreSQL constraints,
and runs critical auth/admin/subscription API checks.

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/tanzim_test"
Set-Location backend
.venv\Scripts\python.exe -m pytest tests/test_postgresql.py
Remove-Item Env:TEST_DATABASE_URL
```

The safety check rejects SQLite, non-PostgreSQL drivers, missing database names,
and database names without `test`.

### Browser/E2E

Install Chromium once, start an isolated full stack, and provide a dedicated
test account. `E2E_BASE_URL` must point to that stack.

```powershell
npx.cmd playwright install chromium
$env:E2E_BASE_URL = "http://127.0.0.1:5173"
$env:E2E_USERNAME = "isolated-e2e-user"
$env:E2E_PASSWORD = Read-Host "E2E test password"
npm.cmd run test:e2e
Remove-Item Env:E2E_PASSWORD
```

If the Playwright CDN is unavailable but a compatible local Chrome is installed,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable before running the
suite. This fallback was used for the recorded QA run.

The authentication journey is skipped when credentials are absent. The PWA
contract test needs the configured server to be running. Playwright keeps
traces/screenshots/video only for failures and uses no arbitrary sleeps.

## Suite boundaries

- Unit tests mock only external seams such as the inventory repository or OPFS.
- IndexedDB tests use `fake-indexeddb` in `happy-dom` while exercising the real Dexie schema and
  repositories.
- OPFS tests use an in-memory File System Access API boundary; object URL cleanup
  is tested through the real React hook.
- PostgreSQL tests use migrations, never `Base.metadata.create_all()`.
- Coverage reports are informational and do not enforce an arbitrary threshold.

See [TESTING_MATRIX.md](TESTING_MATRIX.md) for the risk model and audited gaps.
