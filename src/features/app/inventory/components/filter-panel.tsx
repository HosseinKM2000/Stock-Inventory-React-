import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";

import {
  ArrowUpDown,
  Box,
  Columns2,
  EyeOff,
  Filter,
  Grid2X2,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";

import { Dialog, IconButton, Select, Switch, Text } from "@radix-ui/themes";
import { useState } from "react";

import type { ProductSort } from "../types";
import type { ProductViewMode } from "../services/inventory-list-preferences";
import type { Category, Label } from "@/features/setting/types";
import { LabelFilter } from "./label-filter";

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "جدیدترین",
  oldest: "قدیمی‌ترین",
  price_high: "بیشترین قیمت",
  price_low: "کمترین قیمت",
  quantity_high: "بیشترین تعداد",
  quantity_low: "کمترین تعداد",
};

const VIEW_MODES: Array<{ value: ProductViewMode; label: string; Icon: typeof Grid2X2 }> = [
  { value: "grid", label: "شبکه فشرده", Icon: Grid2X2 },
  { value: "compact", label: "نمای فشرده", Icon: List },
  { value: "comfortable", label: "نمای راحت", Icon: Columns2 },
];

type Props = {
  search: string;
  setSearch: (value: string) => void;
  sort: ProductSort;
  setSort: (value: ProductSort) => void;
  categories: Category[];
  categoryId: number | null;
  setCategoryId: (value: number | null) => void;
  labels: Label[];
  selectedLabelIds: number[];
  onToggleLabel(id: number): void;
  onRemoveLabel(id: number): void;
  onClearLabels(): void;
  catalogProductsHidden: boolean;
  onCatalogVisibilityChange(hidden: boolean): void;
  viewMode: ProductViewMode;
  onViewModeChange(value: ProductViewMode): void;
};

export default function FilterPanel({
  sort,
  search,
  setSort,
  setSearch,
  categories,
  categoryId,
  setCategoryId,
  labels,
  selectedLabelIds,
  onToggleLabel,
  onRemoveLabel,
  onClearLabels,
  catalogProductsHidden,
  onCatalogVisibilityChange,
  viewMode,
  onViewModeChange,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftSort, setDraftSort] = useState<ProductSort>(sort);
  const [draftCategoryId, setDraftCategoryId] = useState<number | null>(categoryId);
  const [draftLabelIds, setDraftLabelIds] = useState<number[]>(selectedLabelIds);
  const [draftCatalogHidden, setDraftCatalogHidden] = useState(catalogProductsHidden);

  const activeFilterCount =
    (categoryId == null ? 0 : 1) +
    selectedLabelIds.length +
    (catalogProductsHidden ? 1 : 0) +
    (sort === "newest" ? 0 : 1);
  const sameLabels =
    draftLabelIds.length === selectedLabelIds.length &&
    draftLabelIds.every((id) => selectedLabelIds.includes(id));
  const hasDraftChanges =
    draftSort !== sort ||
    draftCategoryId !== categoryId ||
    !sameLabels ||
    draftCatalogHidden !== catalogProductsHidden;
  const draftIsReset =
    draftSort === "newest" &&
    draftCategoryId == null &&
    draftLabelIds.length === 0 &&
    !draftCatalogHidden;

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setDraftSort(sort);
      setDraftCategoryId(categoryId);
      setDraftLabelIds(selectedLabelIds);
      setDraftCatalogHidden(catalogProductsHidden);
    }
    setDialogOpen(open);
  };

  const applyDraftFilters = () => {
    if (!hasDraftChanges) return;
    if (draftSort !== sort) setSort(draftSort);
    if (draftCategoryId !== categoryId) setCategoryId(draftCategoryId);
    selectedLabelIds
      .filter((id) => !draftLabelIds.includes(id))
      .forEach(onRemoveLabel);
    draftLabelIds
      .filter((id) => !selectedLabelIds.includes(id))
      .forEach(onToggleLabel);
    if (draftCatalogHidden !== catalogProductsHidden) {
      onCatalogVisibilityChange(draftCatalogHidden);
    }
    setDialogOpen(false);
  };

  return (
    <div className="inventory-filter-panel" dir="rtl">
      <div className="inventory-filter-topline">
        <div className="inventory-filter-heading">
          <SlidersHorizontal size={27} strokeWidth={1.8} aria-hidden="true" />
          <h2>جستجو و فیلتر</h2>
        </div>

        <div className="inventory-view-switcher" role="group" aria-label="انتخاب چیدمان محصولات">
          {VIEW_MODES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              className="inventory-view-button"
              data-active={viewMode === value}
              aria-label={label}
              aria-pressed={viewMode === value}
              onClick={() => onViewModeChange(value)}
            >
              <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ))}
        </div>

        <Dialog.Root open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <Dialog.Trigger>
            <Button type="button" variant="outline" className="inventory-mobile-filter-trigger">
              <Filter size={23} strokeWidth={1.9} aria-hidden="true" />
              <span>فیلترها</span>
              {activeFilterCount > 0 ? (
                <span className="inventory-mobile-filter-count" aria-label={`${activeFilterCount.toLocaleString("fa-IR")} فیلتر فعال`}>
                  {activeFilterCount.toLocaleString("fa-IR")}
                </span>
              ) : null}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content dir="rtl" maxWidth="680px" className="inventory-filter-dialog">
            <div className="inventory-filter-dialog-header">
              <div className="inventory-filter-dialog-title-wrap">
                <span className="inventory-filter-dialog-icon"><Filter size={26} strokeWidth={1.9} aria-hidden="true" /></span>
                <Dialog.Title className="inventory-filter-dialog-title">فیلترها</Dialog.Title>
              </div>
              <Button
                type="button"
                variant="outline"
                className="inventory-filter-reset"
                disabled={draftIsReset}
                onClick={() => {
                  setDraftCategoryId(null);
                  setDraftSort("newest");
                  setDraftLabelIds([]);
                  setDraftCatalogHidden(false);
                }}
              >
                <RotateCcw size={19} aria-hidden="true" />
                بازنشانی همه
              </Button>
              <Dialog.Close>
                <IconButton type="button" variant="soft" color="gray" className="inventory-filter-dialog-x" aria-label="بستن فیلترها">
                  <X size={22} aria-hidden="true" />
                </IconButton>
              </Dialog.Close>
            </div>

            <Dialog.Description className="inventory-filter-dialog-description">
              با استفاده از فیلترها نتایج را محدود کنید.
            </Dialog.Description>

            <div className="inventory-filter-dialog-fields">
              <div className="inventory-filter-dialog-field">
                <Text as="span" weight="bold" className="inventory-filter-dialog-label">دسته‌بندی</Text>
                <div className="inventory-filter-control inventory-category-control">
                  <Box className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
                  <Select.Root value={draftCategoryId == null ? "all" : String(draftCategoryId)} onValueChange={(value) => setDraftCategoryId(value === "all" ? null : Number(value))}>
                    <Select.Trigger aria-label="فیلتر دسته‌بندی در پنجره فیلترها" className="inventory-filter-select" />
                    <Select.Content>
                      <Select.Item value="all">همه دسته‌بندی‌ها</Select.Item>
                      {categories.map((category) => <Select.Item key={category.id} value={String(category.id)}>{category.name}</Select.Item>)}
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>

              <div className="inventory-filter-dialog-field">
                <Text as="span" weight="bold" className="inventory-filter-dialog-label">مرتب‌سازی</Text>
                <div className="inventory-filter-control inventory-sort-control">
                  <ArrowUpDown className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
                  <Select.Root value={draftSort} onValueChange={(value) => setDraftSort(value as ProductSort)}>
                    <Select.Trigger aria-label="مرتب‌سازی محصولات در پنجره فیلترها" className="inventory-filter-select" />
                    <Select.Content>
                      {(Object.keys(SORT_LABELS) as ProductSort[]).map((key) => <Select.Item key={key} value={key}>{SORT_LABELS[key]}</Select.Item>)}
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>

              <div className="inventory-filter-dialog-field">
                <Text as="span" weight="bold" className="inventory-filter-dialog-label">برچسب‌ها</Text>
                <div className="inventory-filter-control inventory-label-control">
                  <Tag className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
                  <LabelFilter
                    labels={labels}
                    selectedIds={draftLabelIds}
                    onToggle={(id) => setDraftLabelIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                    onRemove={(id) => setDraftLabelIds((current) => current.filter((item) => item !== id))}
                    onClear={() => setDraftLabelIds([])}
                    emptyLabel="همه برچسب‌ها"
                  />
                </div>
              </div>
            </div>

            <div className="inventory-filter-dialog-catalog">
              <div className="inventory-filter-dialog-catalog-title">
                <EyeOff size={25} strokeWidth={1.8} aria-hidden="true" />
                <Text as="span" size="3" weight="medium">مخفی کردن کاتالوگ</Text>
              </div>
              <Switch checked={draftCatalogHidden} onCheckedChange={setDraftCatalogHidden} aria-label="مخفی کردن محصولات کاتالوگ در پنجره فیلترها" />
              <Text as="p" size="2" color="gray">محصولات کاتالوگ در نتایج نمایش داده نشوند.</Text>
            </div>

            <Button
              type="button"
              className="inventory-filter-dialog-submit"
              disabled={!hasDraftChanges}
              onClick={applyDraftFilters}
            >
              مشاهده نتایج
            </Button>
          </Dialog.Content>
        </Dialog.Root>
      </div>

      <label className="inventory-search-control">
        <span className="sr-only">جستجو</span>
        <TextInput
          className="inventory-search-input"
          rightSlot={<Search size={28} strokeWidth={1.8} aria-hidden="true" />}
          leftSlot={search ? (
            <IconButton
              type="button"
              variant="ghost"
              color="gray"
              aria-label="پاک کردن جست‌وجو"
              className="inventory-search-clear"
              onClick={() => setSearch("")}
            >
              <X size={21} strokeWidth={1.8} />
            </IconButton>
          ) : null}
          size="3"
          aria-label="جستجوی محصول"
          placeholder="نام یا مشخصات محصول..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <label className="inventory-catalog-filter">
        <EyeOff size={21} strokeWidth={1.8} aria-hidden="true" />
        <Text as="span" size="2" weight="medium">مخفی کردن کاتالوگ</Text>
        <Switch checked={catalogProductsHidden} onCheckedChange={onCatalogVisibilityChange} aria-label="مخفی کردن محصولات کاتالوگ" />
      </label>

      <div className="inventory-filter-row">
        <div className="inventory-filter-control inventory-category-control">
          <Box className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
          <Select.Root value={categoryId == null ? "all" : String(categoryId)} onValueChange={(value) => setCategoryId(value === "all" ? null : Number(value))}>
            <Select.Trigger aria-label="فیلتر دسته‌بندی" className="inventory-filter-select" />
            <Select.Content>
              <Select.Item value="all">همه دسته‌بندی‌ها</Select.Item>
              {categories.map((category) => <Select.Item key={category.id} value={String(category.id)}>{category.name}</Select.Item>)}
            </Select.Content>
          </Select.Root>
        </div>

        <div className="inventory-filter-control inventory-sort-control">
          <ArrowUpDown className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
          <Select.Root value={sort} onValueChange={(value) => setSort(value as ProductSort)}>
            <Select.Trigger aria-label="مرتب‌سازی محصولات" className="inventory-filter-select" />
            <Select.Content>
              {(Object.keys(SORT_LABELS) as ProductSort[]).map((key) => <Select.Item key={key} value={key}>{SORT_LABELS[key]}</Select.Item>)}
            </Select.Content>
          </Select.Root>
        </div>

        <div className="inventory-filter-control inventory-label-control">
          <Tag className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
          <LabelFilter labels={labels} selectedIds={selectedLabelIds} onToggle={onToggleLabel} onRemove={onRemoveLabel} onClear={onClearLabels} />
        </div>

      </div>
    </div>
  );
}
