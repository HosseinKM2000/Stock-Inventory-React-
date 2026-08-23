"""Secure one-time permanent administrator bootstrap.

Usage (PowerShell):
  $env:SYSTEM_ADMIN_PASSWORD = Read-Host "Temporary bootstrap password"
  python -m app.bootstrap_admin

Prefer setting SYSTEM_ADMIN_PASSWORD through the deployment secret manager and
starting the API; startup invokes the same service automatically.
"""

from .database import SessionLocal
from .config import settings
from .services.bootstrap_service import ensure_system_admin


def main() -> None:
    if not settings.SYSTEM_ADMIN_PASSWORD:
        raise SystemExit("SYSTEM_ADMIN_PASSWORD is required")
    with SessionLocal() as db:
        if not ensure_system_admin(db):
            raise SystemExit("SYSTEM_ADMIN_PASSWORD is required")
    print("Permanent system administrator is ready.")


if __name__ == "__main__":
    main()
