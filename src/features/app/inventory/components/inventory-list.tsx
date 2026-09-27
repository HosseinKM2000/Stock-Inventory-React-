import { useEffect, useRef, useState } from "react";
import { Box, Callout, Flex, Select, Spinner, Text } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { useCategories } from "@/features/setting/mutations/use-categories";
import AddButton from "./add-button";
import FilterPanel from "./filter-panel";
import { ProductCard } from "./inventory-card";
import { ProductPreviewDialog } from "./product-preview-dialog";
import type { Product, ProductSort } from "../types";
import { useInventoryVirtual } from "../mutations/useInventoryVirtual";
import { useDeleteProduct, useProducts } from "../mutations/use-products";
import { catalogVisibilityService } from "../services/catalog-visibility.service";
import {
  inventoryListPreferences,
  type ProductViewMode,
} from "../services/inventory-list-preferences";

const QUICK_STOCK_HINT_KEY = "inventory-quick-stock-hint-v3";
const EMPTY_PRODUCTS: Product[] = [];
const VIEW_MODES: Array<{ value: ProductViewMode; label: string }> = [
  { value: "comfortable", label: "نمای راحت" },
  { value: "compact", label: "نمای فشرده" },
  { value: "grid", label: "شبکه فشرده" },
];

const InventoryList = () => {
  const initial = inventoryListPreferences.read();
  const [search, setSearch] = useState(initial.search);
  const [sort, setSort] = useState<ProductSort>(initial.sort);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [viewMode, setViewMode] = useState<ProductViewMode>(initial.viewMode);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [catalogProductsHidden, setCatalogProductsHidden] = useState(() => catalogVisibilityService.isHidden());
  const { data: categories = [] } = useCategories();
  const { data, isLoading, isError } = useProducts({
    search: search || undefined,
    sort,
    category_id: categoryId ?? undefined,
    hide_catalog_products: catalogProductsHidden,
  });
  const products = data ?? EMPTY_PRODUCTS;
  const { parentRef, virtualizer } = useInventoryVirtual(
    viewMode === "grid" ? 0 : products.length,
    viewMode === "compact" ? 86 : 250,
  );
  const deleteProduct = useDeleteProduct();
  const restored = useRef(false);

  useEffect(() => {
    inventoryListPreferences.update({ search, sort, categoryId, viewMode });
  }, [search, sort, categoryId, viewMode]);

  useEffect(() => {
    if (restored.current || isLoading || products.length === 0) return;
    restored.current = true;
    const saved = inventoryListPreferences.read();
    const frame = window.requestAnimationFrame(() => {
      const anchorIndex = saved.anchorProductId == null
        ? -1
        : products.findIndex((product) => product.id === saved.anchorProductId);
      if (viewMode !== "grid" && anchorIndex >= 0) {
        virtualizer.scrollToIndex(anchorIndex, { align: "center" });
      } else if (parentRef.current) {
        parentRef.current.scrollTop = saved.scrollOffset;
      }
      inventoryListPreferences.clearAnchor();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLoading, parentRef, products, viewMode, virtualizer]);

  useEffect(() => () => {
    inventoryListPreferences.update({ scrollOffset: parentRef.current?.scrollTop ?? 0 });
  }, [parentRef]);

  useEffect(() => {
    try {
      if (products.length > 0 && localStorage.getItem(QUICK_STOCK_HINT_KEY) !== "shown") {
        toast.info("برای تغییر سریع موجودی، دکمه مثبت یا منفی را نگه دارید.");
        localStorage.setItem(QUICK_STOCK_HINT_KEY, "shown");
      }
    } catch {
      // Optional storage can be unavailable in strict privacy modes.
    }
  }, [products.length]);

  const rememberEdit = (product: Product) => {
    inventoryListPreferences.rememberEdit(product.id, parentRef.current?.scrollTop ?? 0);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;
    const name = productToDelete.custom_label ?? productToDelete.catalog_product?.name ?? "محصول";
    deleteProduct.mutate(productToDelete.id, {
      onSuccess: () => { setProductToDelete(null); toast.success(`«${name}» حذف شد.`); },
      onError: (error) => toast.error(error instanceof Error ? error.message : "حذف محصول ناموفق بود"),
    });
  };

  const productCard = (product: Product) => (
    <ProductCard
      key={product.id}
      product={product}
      viewMode={viewMode}
      onPreview={setPreviewProduct}
      onEdit={rememberEdit}
      onDelete={() => setProductToDelete(product)}
      deleting={deleteProduct.isPending && deleteProduct.variables === product.id}
    />
  );

  return (
    <Flex direction="column" className="inventory-list-shell h-full min-h-0 overflow-hidden p-4 gap-4">
      <Flex align="center" gap="2" wrap="wrap" className="inventory-toolbar min-w-0">
        <Button
          type="button"
          size="2"
          variant="soft"
          color={catalogProductsHidden ? "gray" : "violet"}
          className="inventory-visibility-button"
          aria-pressed={catalogProductsHidden}
          onClick={() => {
            const next = !catalogProductsHidden;
            catalogVisibilityService.setHidden(next);
            setCatalogProductsHidden(next);
            parentRef.current?.scrollTo({ top: 0 });
            toast.success(next ? "محصولات کاتالوگی مخفی شدند." : "محصولات کاتالوگی نمایش داده می‌شوند.");
          }}
        >
          {catalogProductsHidden ? <EyeOpenIcon /> : <EyeNoneIcon />}
          <span>{catalogProductsHidden ? "نمایش کاتالوگ" : "مخفی کردن کاتالوگ"}</span>
        </Button>

        <Select.Root value={categoryId == null ? "all" : String(categoryId)} onValueChange={(value) => {
          setCategoryId(value === "all" ? null : Number(value));
          parentRef.current?.scrollTo({ top: 0 });
        }}>
          <Select.Trigger aria-label="فیلتر دسته‌بندی" className="inventory-category-filter min-w-0" />
          <Select.Content>
            <Select.Item value="all">همه دسته‌بندی‌ها</Select.Item>
            {categories.map((category) => <Select.Item key={category.id} value={String(category.id)}>{category.name}</Select.Item>)}
          </Select.Content>
        </Select.Root>

        <Select.Root
          value={viewMode}
          onValueChange={(value) => {
            setViewMode(value as ProductViewMode);
            parentRef.current?.scrollTo({ top: 0 });
          }}
        >
          <Select.Trigger
            aria-label="نحوه نمایش محصولات"
            className="inventory-view-mode-select ms-auto min-w-0"
          />
          <Select.Content>
            {VIEW_MODES.map(({ value, label }) => (
              <Select.Item key={value} value={value}>{label}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Box className="lg:hidden! w-full"><FilterPanel search={search} setSearch={(value) => { setSearch(value); parentRef.current?.scrollTo({ top: 0 }); }} sort={sort} setSort={(value) => { setSort(value); parentRef.current?.scrollTo({ top: 0 }); }} /></Box>
      <Flex className="flex-1 overflow-hidden gap-5">
        <Box className="hidden! lg:block! w-80 shrink-0"><div className="sticky top-5"><FilterPanel search={search} setSearch={(value) => { setSearch(value); parentRef.current?.scrollTo({ top: 0 }); }} sort={sort} setSort={(value) => { setSort(value); parentRef.current?.scrollTo({ top: 0 }); }} /></div></Box>
        <Box className="flex-1 min-w-0">
          {isLoading && <Flex justify="center" align="center" className="h-full"><Spinner /></Flex>}
          {isError && <Callout.Root color="red"><Callout.Text>خطا در دریافت محصولات</Callout.Text></Callout.Root>}
          {!isLoading && !isError && products.length === 0 && <Flex justify="center" align="center" className="h-full"><Text color="gray">محصولی یافت نشد</Text></Flex>}
          {products.length > 0 && (
            <div ref={parentRef} className="h-full overflow-y-auto overscroll-contain scrollbar-thin">
              {viewMode === "grid" ? (
                <div className="inventory-compact-grid grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map(productCard)}
                </div>
              ) : (
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const product = products[virtualRow.index];
                    return (
                      <div
                        key={product.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className={viewMode === "compact" ? "pb-2" : "pb-4"}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                      >
                        {productCard(product)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Box>
      </Flex>

      <AddButton />
      <ProductPreviewDialog product={previewProduct} onOpenChange={(open) => { if (!open) setPreviewProduct(null); }} />
      <ConfirmDialog
        open={productToDelete !== null}
        onOpenChange={(open) => { if (!open) setProductToDelete(null); }}
        title="محصول حذف شود؟"
        description={productToDelete ? `آیا از حذف «${productToDelete.custom_label ?? productToDelete.catalog_product?.name ?? "این محصول"}» مطمئن هستید؟` : ""}
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
