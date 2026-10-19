import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { ArrowUpDown, EyeOff, Search, X } from "lucide-react";

import { Flex, IconButton, Popover, RadioGroup, Select, Switch, Text } from "@radix-ui/themes";

import type { ProductSort } from "../types";
import type { Category, Label } from "@/features/setting/types";
import { LabelFilter } from "./label-filter";

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "جدیدترین",
  oldest: "قدیمی ترین",
  price_high: "بیشترین قیمت",
  price_low: "کمترین قیمت",
  quantity_high: "بیشترین تعداد",
  quantity_low: "کمترین تعداد",
};

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
}: Props) {
  return (
    <Flex direction="column" gap="4" width="100%" className="inventory-filter-panel">
      <label className="inventory-filter-control">
        <Text as="span" size="2" weight="bold">جستجو</Text>
        <TextInput
          className="w-full"
          rightSlot={<Search size={20} aria-hidden="true" />}
          leftSlot={search ? <IconButton type="button" size="1" variant="ghost" color="gray" aria-label="پاک کردن جست‌وجو" onClick={() => setSearch("")}><X size={16} /></IconButton> : null}
          size="3"
          aria-label="جستجوی محصول"
          placeholder="نام یا مشخصات محصول..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <Flex direction="column" gap="2" className="inventory-filter-control">
        <Text size="2" weight="bold">دسته‌بندی‌ها</Text>
        <Select.Root value={categoryId == null ? "all" : String(categoryId)} onValueChange={(value) => setCategoryId(value === "all" ? null : Number(value))}>
          <Select.Trigger aria-label="فیلتر دسته‌بندی" className="w-full min-w-0" />
          <Select.Content>
            <Select.Item value="all">همه دسته‌بندی‌ها</Select.Item>
            {categories.map((category) => <Select.Item key={category.id} value={String(category.id)}>{category.name}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Flex direction="column" gap="2" className="inventory-filter-control">
        <Text size="2" weight="bold">مرتب‌سازی</Text>
        <Popover.Root>
          <Popover.Trigger>
            <Button type="button" variant="soft" className="w-full justify-between">
              <ArrowUpDown size={19} aria-hidden="true" />
              <Text size="2">{SORT_LABELS[sort]}</Text>
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
      </Flex>

      <Flex direction="column" gap="2" className="inventory-filter-control">
        <Text size="2" weight="bold">برچسب‌ها</Text>
        <LabelFilter labels={labels} selectedIds={selectedLabelIds} onToggle={onToggleLabel} onRemove={onRemoveLabel} onClear={onClearLabels} />
      </Flex>

      <label className="inventory-catalog-filter flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--gray-a6)] p-3">
        <Flex align="center" gap="2">
          <EyeOff size={18} aria-hidden="true" />
          <Text size="2" weight="bold">مخفی کردن کاتالوگ</Text>
        </Flex>
        <Switch checked={catalogProductsHidden} onCheckedChange={onCatalogVisibilityChange} aria-label="مخفی کردن محصولات کاتالوگ" />
      </label>
    </Flex>
  );
}
