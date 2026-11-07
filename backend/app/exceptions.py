import logging
from pathlib import Path
import traceback

from fastapi import Request
from fastapi.responses import JSONResponse

from .config import settings


logger = logging.getLogger("tanzim.api")


async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unavailable")
    frame = traceback.extract_tb(exc.__traceback__)[-1] if exc.__traceback__ else None
    logger.error(
        "Unhandled API error request_id=%s method=%s path=%s error_type=%s location=%s",
        request_id,
        request.method,
        request.url.path,
        type(exc).__name__,
        f"{Path(frame.filename).name}:{frame.lineno}:{frame.name}" if frame else "unavailable",
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "خطای داخلی سرور",
            "request_id": request_id,
        },
        headers={
            "X-Request-ID": request_id,
            "X-Tanzim-Build": settings.APP_BUILD_ID,
            "X-Tanzim-Schema": settings.DATABASE_SCHEMA_VERSION,
        },
    )
