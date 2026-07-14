import json
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, status

from ..config import settings

router = APIRouter(
    prefix="/bale",
    tags=["bale"],
)


def _call_bale(method: str, payload: dict) -> dict:
    if not settings.BALE_BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bale bot token is not configured.",
        )

    request = Request(
        f"https://tapi.bale.ai/bot{settings.BALE_BOT_TOKEN}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Bale API request failed.",
        ) from exc


def _send_open_app_message(chat_id: int | str) -> None:
    _call_bale(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": "برای مدیریت موجودی، دکمه زیر را بزنید.",
            "reply_markup": {
                "inline_keyboard": [
                    [
                        {
                            "text": "باز کردن انبار پارسین",
                            "web_app": {
                                "url": settings.BALE_WEB_APP_URL,
                            },
                        }
                    ]
                ]
            },
        },
    )


@router.post("/webhook")
def webhook(update: dict):
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    text = message.get("text") or ""
    web_app_data = message.get("web_app_data")

    if web_app_data:
        return {"ok": True}

    if text.startswith("/start") and chat.get("id") is not None:
        _send_open_app_message(chat["id"])

    return {"ok": True}
