from datetime import datetime, timezone
from zoneinfo import ZoneInfo

PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def gregorian_to_jalali(year: int, month: int, day: int) -> tuple[int, int, int]:
    g_month_days = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    gy = year - 1600
    gm = month - 1
    gd = day - 1
    days = 365 * gy + (gy + 3) // 4 - (gy + 99) // 100 + (gy + 399) // 400
    days += sum(g_month_days[:gm]) + gd
    if gm > 1 and ((year % 4 == 0 and year % 100 != 0) or year % 400 == 0):
        days += 1
    days -= 79
    cycles, days = divmod(days, 12053)
    jy = 979 + 33 * cycles + 4 * (days // 1461)
    days %= 1461
    if days >= 366:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm, jd = 1 + days // 31, 1 + days % 31
    else:
        jm, jd = 7 + (days - 186) // 30, 1 + (days - 186) % 30
    return jy, jm, jd


def format_jalali_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    local = value.astimezone(ZoneInfo("Asia/Tehran"))
    year, month, day = gregorian_to_jalali(local.year, local.month, local.day)
    return f"{year:04d}/{month:02d}/{day:02d} {local.hour:02d}:{local.minute:02d}".translate(PERSIAN_DIGITS)
