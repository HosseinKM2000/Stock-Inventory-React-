import re


INVALID_MOBILE_MESSAGE = "شماره موبایل معتبر نیست."
DUPLICATE_MOBILE_MESSAGE = "این شماره موبایل قبلاً ثبت شده است."

_DIGIT_TRANSLATION = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)
_CANONICAL_MOBILE = re.compile(r"09\d{9}\Z")


def normalize_iranian_mobile(value: str) -> str:
    """Return an Iranian mobile in canonical local form (09xxxxxxxxx)."""
    normalized = value.strip().translate(_DIGIT_TRANSLATION)
    if normalized.startswith("+98"):
        normalized = "0" + normalized[3:]
    elif normalized.startswith("0098"):
        normalized = "0" + normalized[4:]

    if not _CANONICAL_MOBILE.fullmatch(normalized):
        raise ValueError(INVALID_MOBILE_MESSAGE)
    return normalized
