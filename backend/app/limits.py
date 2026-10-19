from .plans import PlanType


PLAN_LIMITS = {
    PlanType.free: {
        "inventory_limit": 50,
        "catalog_sync": False,
        "backup": False,
        "offline_full": True,
    },
    PlanType.pro: {
        "inventory_limit": 5000,
        "catalog_sync": True,
        "backup": True,
        "offline_full": True,
    },
    PlanType.premium: {
        "inventory_limit": -1,  # unlimited
        "catalog_sync": True,
        "backup": True,
        "offline_full": True,
    },
}