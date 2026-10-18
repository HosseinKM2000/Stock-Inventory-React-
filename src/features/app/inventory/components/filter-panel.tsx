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

import { Dialog, Flex, IconButton, Popover, RadioGroup, Select, Switch, Text } from "@radix-ui/themes";

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

        <Dialog.Root>
          <Dialog.Trigger>
            <Button type="button" variant="soft" className="inventory-mobile-filter-trigger">
              <Filter size={23} strokeWidth={1.9} aria-hidden="true" />
              <span>فیلترها</span>
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
                onClick={() => {
                  setCategoryId(null);
                  setSort("newest");
                  onClearLabels();
                  if (catalogProductsHidden) onCatalogVisibilityChange(false);
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
                  <Select.Root value={categoryId == null ? "all" : String(categoryId)} onValueChange={(value) => setCategoryId(value === "all" ? null : Number(value))}>
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
                  <Popover.Root>
                    <Popover.Trigger>
                      <Button type="button" variant="soft" className="inventory-filter-button">
                        <ArrowUpDown className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
                        <span>{SORT_LABELS[sort]}</span>
                        <span className="inventory-filter-chevron" aria-hidden="true" />
                      </Button>
                    </Popover.Trigger>
                    <Popover.Content width="280px" className="inventory-sort-popover">
                      <RadioGroup.Root value={sort} onValueChange={(value) => setSort(value as ProductSort)}>
                        <Flex direction="column" gap="3" align="end">
                          {(Object.keys(SORT_LABELS) as ProductSort[]).map((key) => (
                            <Flex key={key} align="center" gap="2">
                              <Text size="2" weight="bold">{SORT_LABELS[key]}</Text>
                              <RadioGroup.Item value={key} />
                            </Flex>
                          ))}
                        </Flex>
                      </RadioGroup.Root>
                    </Popover.Content>
                  </Popover.Root>
                </div>
              </div>

              <div className="inventory-filter-dialog-field">
                <Text as="span" weight="bold" className="inventory-filter-dialog-label">برچسب‌ها</Text>
                <div className="inventory-filter-control inventory-label-control">
                  <Tag className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
                  <LabelFilter labels={labels} selectedIds={selectedLabelIds} onToggle={onToggleLabel} onRemove={onRemoveLabel} onClear={onClearLabels} emptyLabel="همه برچسب‌ها" />
                </div>
              </div>
            </div>

            <div className="inventory-filter-dialog-catalog">
              <div className="inventory-filter-dialog-catalog-title">
                <EyeOff size={25} strokeWidth={1.8} aria-hidden="true" />
                <Text as="span" size="3" weight="medium">مخفی کردن کاتالوگ</Text>
              </div>
              <Switch checked={catalogProductsHidden} onCheckedChange={onCatalogVisibilityChange} aria-label="مخفی کردن محصولات کاتالوگ در پنجره فیلترها" />
              <Text as="p" size="2" color="gray">محصولات کاتالوگ در نتایج نمایش داده نشوند.</Text>
            </div>

            <Dialog.Close>
              <Button type="button" className="inventory-filter-dialog-close">بستن</Button>
            </Dialog.Close>
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
          <Popover.Root>
            <Popover.Trigger>
              <Button type="button" variant="soft" className="inventory-filter-button">
                <ArrowUpDown className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
                <span>{SORT_LABELS[sort]}</span>
                <span className="inventory-filter-chevron" aria-hidden="true" />
              </Button>
            </Popover.Trigger>
            <Popover.Content width="280px" className="inventory-sort-popover">
              <RadioGroup.Root value={sort} onValueChange={(value) => setSort(value as ProductSort)}>
                <Flex direction="column" gap="3" align="end">
                  {(Object.keys(SORT_LABELS) as ProductSort[]).map((key) => (
                    <Flex key={key} align="center" gap="2">
                      <Text size="2" weight="bold">{SORT_LABELS[key]}</Text>
                      <RadioGroup.Item value={key} />
                    </Flex>
                  ))}
                </Flex>
              </RadioGroup.Root>
            </Popover.Content>
          </Popover.Root>
        </div>

        <div className="inventory-filter-control inventory-label-control">
          <Tag className="inventory-filter-leading-icon" size={25} strokeWidth={1.8} aria-hidden="true" />
          <LabelFilter labels={labels} selectedIds={selectedLabelIds} onToggle={onToggleLabel} onRemove={onRemoveLabel} onClear={onClearLabels} />
        </div>

        <label className="inventory-catalog-filter">
          <EyeOff size={25} strokeWidth={1.8} aria-hidden="true" />
          <Text as="span" size="3" weight="medium">مخفی کردن کاتالوگ</Text>
          <Switch checked={catalogProductsHidden} onCheckedChange={onCatalogVisibilityChange} aria-label="مخفی کردن محصولات کاتالوگ" />
        </label>
      </div>
    </div>
  );
}
