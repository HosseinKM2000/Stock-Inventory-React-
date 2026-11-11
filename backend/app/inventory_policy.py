# Operational domain ceiling per product/SKU. It stays below the common
# signed int32 boundary while leaving headroom for stock arithmetic.
MAX_PRODUCT_QUANTITY = 1_000_000_000
PRODUCT_QUANTITY_LIMIT_ERROR = "PRODUCT_QUANTITY_LIMIT_EXCEEDED"


def validate_product_quantity(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("PRODUCT_QUANTITY_INVALID")
    if value > MAX_PRODUCT_QUANTITY:
        raise ValueError(PRODUCT_QUANTITY_LIMIT_ERROR)
    return value
