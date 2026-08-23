from .plans import PLAN_CATALOG

PLAN_LIMITS = {name: value["limits"] for name, value in PLAN_CATALOG.items()}
