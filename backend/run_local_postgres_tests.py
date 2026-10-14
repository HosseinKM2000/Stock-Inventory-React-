"""Run destructive PostgreSQL tests against an isolated local test database."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

from sqlalchemy.engine import make_url

from app.config import settings


def main() -> int:
    source = make_url(settings.DATABASE_URL)
    if settings.ENVIRONMENT not in {"development", "test"}:
        raise RuntimeError("LOCAL_POSTGRES_TESTS_REQUIRE_DEVELOPMENT_OR_TEST")
    if source.get_backend_name() != "postgresql" or (source.host or "") not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("LOCAL_POSTGRES_TESTS_REQUIRE_LOCAL_POSTGRESQL")

    test_url = source.set(database="tanzim_test")
    environment = os.environ.copy()
    environment.update({
        "TEST_DATABASE_URL": test_url.render_as_string(hide_password=False),
        "DATABASE_URL": test_url.render_as_string(hide_password=False),
        "ENVIRONMENT": "test",
        "SECRET_KEY": "test-only-signing-key-never-use-in-production",
        "SYSTEM_ADMIN_PASSWORD": "Test-only-system-admin-password-123!",
    })
    backend_dir = Path(__file__).resolve().parent
    return subprocess.call([
        sys.executable, "-m", "pytest",
        "-c", str(backend_dir / "pytest.ini"),
        str(backend_dir / "tests" / "test_postgresql.py"),
    ], env=environment)


if __name__ == "__main__":
    raise SystemExit(main())
