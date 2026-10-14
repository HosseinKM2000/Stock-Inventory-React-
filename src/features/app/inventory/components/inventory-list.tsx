import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Callout, Flex, Select, Spinner, Text } from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { useCategories } from "@/features/setting/mutations/use-categories";
import FilterPanel from "./filter-panel";
import { ProductCard } from "./inventory-card";
import { ProductImageDialog } from "./product-image-dialog";
import { BulkEditDialog } from "./bulk-edit-dialog";
import { BulkSelectionActions } from "./bulk-selection-actions";
import type { Product, ProductSort } from "../types";
import { useInventoryVirtual } from "../mutations/useInventoryVirtual";
import {
  useBulkDeleteProducts,
  useDeleteProduct,
  useProducts,
} from "../mutations/use-products";
import { catalogVisibilityService } from "../services/catalog-visibility.service";
import { inventoryService } from "../services/inventory-service";
import { useProductSelection } from "../hooks/use-product-selection";
import { useProductLabelFilter } from "../hooks/use-product-label-filter";
import { useLabels } from "@/features/setting/mutations/use-labels";
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
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [catalogProductsHidden, setCatalogProductsHidden] = useState(() => catalogVisibilityService.isHidden());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const closeBulkOnAccountChange = useCallback(() => {
    setBulkOpen(false);
    setBulkDeleteOpen(false);
  }, []);
  const selection = useProductSelection(closeBulkOnAccountChange);
  const {
    selectedLabelIds,
    toggle: toggleLabel,
    remove: removeLabel,
    clear: clearLabels,
    retainAvailable: retainAvailableLabels,
  } = useProductLabelFilter();
  const { selectedIds, selectionMode, retainAvailable } = selection;
  const { data: categories = [] } = useCategories();
  const { data: labels = [] } = useLabels();
  const { data, isLoading, isError } = useProducts({
    search: search || undefined,
    sort,
    category_id: categoryId ?? undefined,
    label_ids: selectedLabelIds.length ? selectedLabelIds : undefined,
    hide_catalog_products: catalogProductsHidden,
  });
  const products = data ?? EMPTY_PRODUCTS;
  const { parentRef, virtualizer } = useInventoryVirtual(
    viewMode === "grid" ? 0 : products.length,
    viewMode === "compact" ? 86 : 250,
  );
  const deleteProduct = useDeleteProduct();
  const bulkDeleteProducts = useBulkDeleteProducts();
  const restored = useRef(false);
  useEffect(() => {
    retainAvailableLabels(new Set(labels.map((label) => label.id)));
  }, [retainAvailableLabels, labels]);

  useEffect(() => {
    if (!selectionMode) return;
    let cancelled = false;
    void inventoryService.getAll({ include_hidden: true })
      .then((all) => {
        if (cancelled) return;
        const available = new Set(all.map((product) => product.id));
        retainAvailable(available);
      })
      .catch(() => { /* Keep selection when local availability cannot be verified. */ });
    return () => { cancelled = true; };
  }, [products, selectionMode, retainAvailable]);

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

  const confirmBulkDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkDeleteProducts.isPending) return;

    bulkDeleteProducts.mutate(ids, {
      onSuccess: (deletedIds) => {
        setBulkDeleteOpen(false);
        selection.remove(deletedIds);
        toast.success(`${deletedIds.length.toLocaleString("fa-IR")} محصول حذف شد.`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "حذف گروهی محصولات ناموفق بود");
      },
    });
  };

  const updateCatalogVisibility = (hidden: boolean) => {
    catalogVisibilityService.setHidden(hidden);
    setCatalogProductsHidden(hidden);
    parentRef.current?.scrollTo({ top: 0 });
    toast.success(hidden ? "محصولات کاتالوگی مخفی شدند." : "محصولات کاتالوگی نمایش داده می‌شوند.");
  };

  const productCard = (product: Product) => (
    <ProductCard
      key={product.id}
      product={product}
      viewMode={viewMode}
      onImageOpen={setImageProduct}
      onEdit={rememberEdit}
      onDelete={() => setProductToDelete(product)}
      deleting={deleteProduct.isPending && deleteProduct.variables === product.id}
      selectionMode={selectionMode}
      selected={selectedIds.has(product.id)}
      onEnterSelection={(item) => selection.enter(item.id)}
      onToggleSelection={(item) => selection.toggle(item.id)}
    />
  );

  return (
    <Flex direction="column" className="inventory-list-shell h-full min-h-0 overflow-hidden p-4 gap-4">
      <Flex align="center" gap="2" wrap="wrap" className="inventory-toolbar min-w-0">
        {selectionMode && <Flex align="center" gap="2" role="status" aria-live="polite">
          <Text weight="bold">{selectedIds.size.toLocaleString("fa-IR")} انتخاب</Text>
          <Button type="button" size="2" variant="soft" color="gray" aria-label="خروج از حالت انتخاب" onClick={selection.clear}><Cross2Icon /> پاک‌کردن</Button>
        </Flex>}
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

      <div className="inventory-list-workspace flex-1 min-h-0">
        <aside className="inventory-filter-sidebar min-h-0" aria-label="فیلترهای محصولات">
        <FilterPanel
          search={search}
          setSearch={(value) => { setSearch(value); parentRef.current?.scrollTo({ top: 0 }); }}
          sort={sort}
          setSort={(value) => { setSort(value); parentRef.current?.scrollTo({ top: 0 }); }}
          categories={categories}
          categoryId={categoryId}
          setCategoryId={(value) => { setCategoryId(value); parentRef.current?.scrollTo({ top: 0 }); }}
          labels={labels}
          selectedLabelIds={selectedLabelIds}
          onToggleLabel={toggleLabel}
          onRemoveLabel={removeLabel}
          onClearLabels={clearLabels}
          catalogProductsHidden={catalogProductsHidden}
          onCatalogVisibilityChange={updateCatalogVisibility}
        />
        </aside>
        <Box className="inventory-list-results min-h-0 min-w-0">
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
      </div>

      {selectionMode && <BulkSelectionActions
        selectedCount={selectedIds.size}
        deleting={bulkDeleteProducts.isPending}
        onEdit={() => setBulkOpen(true)}
        onDelete={() => setBulkDeleteOpen(true)}
      />}
      <BulkEditDialog
        open={bulkOpen}
        selectedIds={[...selectedIds]}
        onOpenChange={setBulkOpen}
        onComplete={(updated) => {
          const updatedSet = new Set(updated);
          selection.remove(updatedSet);
        }}
      />
      <ProductImageDialog product={imageProduct} onOpenChange={(open) => { if (!open) setImageProduct(null); }} />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="محصولات انتخاب‌شده حذف شوند؟"
        description={`با تأیید، ${selectedIds.size.toLocaleString("fa-IR")} محصول انتخاب‌شده از موجودی حذف می‌شود و این تغییر پس از همگام‌سازی روی سرور نیز اعمال خواهد شد.`}
        confirmLabel={`حذف ${selectedIds.size.toLocaleString("fa-IR")} محصول`}
        cancelLabel="لغو"
        variant="danger"
        loading={bulkDeleteProducts.isPending}
        onConfirm={confirmBulkDelete}
      />
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
