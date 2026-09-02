import { useEffect, useState } from "react";
import AddButton from "./add-button";
import FilterPanel from "./filter-panel";
import type { Product, ProductSort } from "../types";
import { ProductCard } from "./inventory-card";
import { Box, Callout, Flex, Spinner, Text } from "@radix-ui/themes";
import { useInventoryVirtual } from "../mutations/useInventoryVirtual";
import { useDeleteProduct, useProducts } from "../mutations/use-products";
import { toast } from "sonner";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Button } from "@/shared/ui/button/button";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { catalogVisibilityService } from "../services/catalog-visibility.service";

const QUICK_STOCK_HINT_KEY = "inventory-quick-stock-hint-v3";

const InventoryList = () => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [catalogProductsHidden, setCatalogProductsHidden] = useState(() =>
    catalogVisibilityService.isHidden(),
  );

  const { data, isLoading, isError } = useProducts({
    search: search || undefined,
    sort,
    hide_catalog_products: catalogProductsHidden,
  });

  const products = data ?? [];

  const { parentRef, virtualizer } = useInventoryVirtual(products.length);

  const deleteProduct = useDeleteProduct();

  const confirmDelete = () => {
    if (!productToDelete) return;

    const name =
      productToDelete.custom_label ??
      productToDelete.catalog_product?.name ??
      "محصول";

    deleteProduct.mutate(productToDelete.id, {
      onSuccess: () => {
        setProductToDelete(null);
        toast.success(`«${name}» حذف شد.`);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "حذف محصول ناموفق بود",
        );
      },
    });
  };

  useEffect(() => {
    try {
      if (products.length > 0 && localStorage.getItem(QUICK_STOCK_HINT_KEY) !== "shown") {
        toast.info("برای یک تغییر کلیک کنید؛ برای تغییر سریع دکمه مثبت یا منفی را نگه دارید.");
        localStorage.setItem(QUICK_STOCK_HINT_KEY, "shown");
      }
    } catch {
      // Storage may be unavailable in strict privacy modes; the feature still works.
    }
  }, [products.length]);

  return (
    <Flex
      direction="column"
      className="
        inventory-list-shell h-full min-h-0
        overflow-hidden
        p-4
        gap-4
      "
    >
      <Flex
        align="center"
        justify="between"
        gap="2"
        className="inventory-visibility-row"
      >
        <Button
          type="button"
          size="2"
          variant="soft"
          color={catalogProductsHidden ? "gray" : "violet"}
          className="inventory-visibility-button"
          aria-label={
            catalogProductsHidden
              ? "نمایش محصولات کاتالوگی"
              : "مخفی کردن محصولات کاتالوگی"
          }
          onClick={() => {
            const next = !catalogProductsHidden;
            catalogVisibilityService.setHidden(next);
            setCatalogProductsHidden(next);
            toast.success(
              next
                ? "محصولات کاتالوگی از فهرست عملیاتی مخفی شدند."
                : "محصولات کاتالوگی دوباره نمایش داده می‌شوند.",
            );
          }}
        >
          {catalogProductsHidden ? <EyeOpenIcon /> : <EyeNoneIcon />}
          <span className="hidden sm:inline">
            {catalogProductsHidden
              ? "نمایش محصولات کاتالوگی"
              : "مخفی کردن محصولات کاتالوگی"}
          </span>
          <span className="sm:hidden">
            {catalogProductsHidden ? "نمایش کاتالوگ" : "مخفی کردن کاتالوگ"}
          </span>
        </Button>
      </Flex>

      {/* FILTERS MOBILE + TABLET */}

      <Box
        className="
          lg:hidden!
          w-full
        "
      >
        <FilterPanel
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
      </Box>

      <Flex
        className="
          flex-1
          overflow-hidden
          gap-5
        "
      >
        {/* DESKTOP FILTER */}

        <Box
          className="
            hidden!
            lg:block!
            w-80
            shrink-0
          "
        >
          <div
            className="
              sticky
              top-5
            "
          >
            <FilterPanel
              search={search}
              setSearch={setSearch}
              sort={sort}
              setSort={setSort}
            />
          </div>
        </Box>
        {/* PRODUCTS */}

        <Box
          className="
            flex-1
            min-w-0
          "
        >
          {isLoading && (
            <Flex justify="center" align="center" className="h-full">
              <Spinner />
            </Flex>
          )}

          {isError && (
            <Callout.Root color="red">
              <Callout.Text>خطا در دریافت محصولات</Callout.Text>
            </Callout.Root>
          )}

          {!isLoading && !isError && products.length === 0 && (
            <Flex justify="center" align="center" className="h-full">
              <Text color="gray">محصولی یافت نشد</Text>
            </Flex>
          )}

          {products.length > 0 && (
            <div
              ref={parentRef}
              className="
                h-full
                overflow-y-auto
                scrollbar-thin
              "
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const product = products[virtualRow.index];

                  return (
                    <div
                      key={product.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        className="
                            pb-4
                          "
                      >
                        <ProductCard
                          product={product}
                          onDelete={() => setProductToDelete(product)}
                          deleting={
                            deleteProduct.isPending &&
                            deleteProduct.variables === product.id
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Box>
      </Flex>

      <AddButton />

      <ConfirmDialog
        open={productToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        title="محصول حذف شود؟"
        description={
          productToDelete
            ? `آیا از حذف «${productToDelete.custom_label ?? productToDelete.catalog_product?.name ?? "این محصول"}» مطمئن هستید؟ این تغییر پس از همگام‌سازی روی سرور نیز اعمال می‌شود.`
            : ""
        }
        confirmLabel="حذف محصول"
        cancelLabel="لغو"
        variant="danger"
        loading={deleteProduct.isPending}
        onConfirm={confirmDelete}
      />
    </Flex>
  );
};

export default InventoryList;
