import { useMemo, useState } from "react";
import { Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Checkbox, Flex, Popover, Text, TextField } from "@radix-ui/themes";
import { Button } from "@/shared/ui/button/button";
import type { Label } from "@/features/setting/types";
import { normalizeProductSearch } from "../services/inventory-service";

type Props = {
  labels: Label[];
  selectedIds: number[];
  onToggle(id: number): void;
  onRemove(id: number): void;
  onClear(): void;
  emptyLabel?: string;
};

export function LabelFilter({ labels, selectedIds, onToggle, onRemove, onClear, emptyLabel = "برچسب‌ها" }: Props) {
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleLabels = useMemo(() => {
    const query = normalizeProductSearch(search);
    return query
      ? labels.filter((label) => normalizeProductSearch(label.name).includes(query))
      : labels;
  }, [labels, search]);
  const selectedLabels = useMemo(() => {
    const byId = new Map(labels.map((label) => [label.id, label]));
    return selectedIds.flatMap((id) => byId.get(id) ?? []);
  }, [labels, selectedIds]);

  return <Flex direction="column" gap="2" width="100%">
    <Popover.Root onOpenChange={(open) => { if (!open) setSearch(""); }}>
      <Popover.Trigger>
        <Button type="button" variant="soft" className="inventory-filter-button inventory-label-filter-trigger" aria-label="فیلتر محصولات بر اساس برچسب">
          <span>{selectedIds.length ? "برچسب‌ها" : emptyLabel}</span>
          {selectedIds.length ? <Text size="1">{selectedIds.length.toLocaleString("fa-IR")}</Text> : null}
          <span className="inventory-filter-chevron" aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Content width="min(320px, calc(100vw - 2rem))" dir="rtl">
        <Flex direction="column" gap="3">
          <TextField.Root
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی برچسب"
            aria-label="جستجوی برچسب"
          ><TextField.Slot side="right"><MagnifyingGlassIcon /></TextField.Slot></TextField.Root>
          <div className="max-h-56 overflow-y-auto">
            <Flex direction="column" gap="1">
              {visibleLabels.map((label) => <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--gray-a3)]">
                <Checkbox checked={selected.has(label.id)} onCheckedChange={() => onToggle(label.id)} />
                <Text size="2">{label.name}</Text>
              </label>)}
              {visibleLabels.length === 0 ? <Text size="2" color="gray" align="center" className="py-3">برچسبی پیدا نشد</Text> : null}
            </Flex>
          </div>
          <Button type="button" size="1" variant="ghost" color="gray" disabled={selectedIds.length === 0} onClick={onClear}>پاک‌کردن همه برچسب‌ها</Button>
        </Flex>
      </Popover.Content>
    </Popover.Root>
    {selectedLabels.length > 0 ? <Flex gap="2" wrap="wrap" aria-label="برچسب‌های انتخاب‌شده">
      {selectedLabels.map((label) => <Button
        key={label.id}
        type="button"
        size="1"
        variant="soft"
        color="violet"
        aria-label={`حذف برچسب ${label.name} از فیلتر`}
        onClick={() => onRemove(label.id)}
      >{label.name}<Cross2Icon /></Button>)}
    </Flex> : null}
  </Flex>;
}
