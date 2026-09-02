"""Shared fast-suite environment established before test-module imports."""

import os
import tempfile
from pathlib import Path


_file = tempfile.NamedTemporaryFile(suffix="-tanzim-fast-tests.db", delete=False)
_file.close()
FAST_DATABASE_PATH = Path(_file.name)

os.environ["DATABASE_URL"] = f"sqlite:///{FAST_DATABASE_PATH.as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["SYSTEM_ADMIN_PASSWORD"] = "Test-only-system-admin-password-123!"
os.environ["SECRET_KEY"] = "test-only-signing-key-never-use-in-production"


def pytest_sessionfinish(session, exitstatus):
    FAST_DATABASE_PATH.unlink(missing_ok=True)
