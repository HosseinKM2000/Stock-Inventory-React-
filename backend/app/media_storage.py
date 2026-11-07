import os
import uuid
from pathlib import Path

from .config import settings


class LocalDurableMediaStorage:
    """Filesystem adapter for a durable volume outside the application tree."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or settings.MEDIA_STORAGE_DIR).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        candidate = (self.root / key).resolve()
        if self.root not in candidate.parents:
            raise ValueError("MEDIA_STORAGE_KEY_INVALID")
        return candidate

    def put_if_absent(self, key: str, content: bytes) -> None:
        destination = self._path(key)
        if destination.is_file():
            return
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.pending")
        try:
            with temporary.open("xb") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, destination)
            if os.name != "nt":
                directory = os.open(destination.parent, os.O_RDONLY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
        finally:
            temporary.unlink(missing_ok=True)

    def path_for(self, key: str) -> Path:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        return path


media_storage = LocalDurableMediaStorage()
