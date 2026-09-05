import logging

from fastapi import Request
from fastapi.responses import JSONResponse


logger = logging.getLogger("tanzim.api")


async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled API error for %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "خطای داخلی سرور"
        },
    )
