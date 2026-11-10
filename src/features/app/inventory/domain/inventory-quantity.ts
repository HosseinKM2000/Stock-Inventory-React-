// Operational domain ceiling per product/SKU. It stays below the common
// signed int32 boundary while leaving headroom for stock arithmetic.
export const MAX_PRODUCT_QUANTITY = 1_000_000_000;

export const MAX_PRODUCT_QUANTITY_LABEL = MAX_PRODUCT_QUANTITY.toLocaleString("fa-IR");

export const PRODUCT_QUANTITY_LIMIT_MESSAGE =
  `موجودی هر محصول نمی‌تواند بیشتر از ${MAX_PRODUCT_QUANTITY_LABEL} عدد باشد`;

export function productQuantityError(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0) {
    return "موجودی محصول باید یک عدد صحیح و نامنفی باشد";
  }
  return value > MAX_PRODUCT_QUANTITY ? PRODUCT_QUANTITY_LIMIT_MESSAGE : null;
}

export function assertProductQuantity(value: number): void {
  const error = productQuantityError(value);
  if (error) throw new Error(error);
}
