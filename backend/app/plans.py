from enum import Enum


class PlanType(str, Enum):
    free = "free"
    pro = "pro"
    premium = "premium"