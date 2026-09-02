"""Secure one-time permanent administrator bootstrap.

Usage (PowerShell):
  $env:SYSTEM_ADMIN_PASSWORD = Read-Host "Temporary bootstrap password"
  python -m app.bootstrap_admin

Set SYSTEM_ADMIN_PASSWORD through the deployment secret manager, run this
command once, and then remove the variable from the environment.
"""

from .database import SessionLocal
from .config import settings
from .services.bootstrap_service import ensure_system_admin
from .services.subscription_service import seed_default_plans


def main() -> None:
    if not settings.SYSTEM_ADMIN_PASSWORD:
        raise SystemExit("SYSTEM_ADMIN_PASSWORD is required")
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    print("Permanent system administrator is ready.")


if __name__ == "__main__":
    main()
