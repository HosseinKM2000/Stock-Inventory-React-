import type { ExportScope } from "@/features/setting/services/export.service";
import {
  Crosshair1Icon,
  ExclamationTriangleIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import { Box, Checkbox, Flex, RadioCards, Select, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";

import { useCategories } from "@/features/setting/mutations/use-categories";

type DataScopeProps = {
  scope: ExportScope;

  onScopeChange(scope: ExportScope): void;

  categoryId: number | null;

  onCategoryChange(categoryId: number | null): void;

  selectedIds: number[];

  onSelectedIdsChange(ids: number[]): void;
};

const DataScope = ({
  scope,
  onScopeChange,
  categoryId,
  onCategoryChange,
  selectedIds,
  onSelectedIdsChange,
}: DataScopeProps) => {
  // Category names come from the API; offline the list is simply empty and the
  // user can still export every product locally.
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useQuery({
    queryKey: ["export", "local-products"],
    queryFn: () => inventoryService.getAll(),
  });

  return (
    <Box mt={"5"}>
      <RadioCards.Root
        value={scope}
        onValueChange={(next) => onScopeChange(next as ExportScope)}
        columns={{ initial: "1", sm: "1" }}
      >
        <RadioCards.Item value="all">
          <Flex width="100%" align={"center"} gapX={"3"}>
            <MixIcon />
            <Text weight="bold">همه محصولات</Text>
          </Flex>
        </RadioCards.Item>
        <RadioCards.Item value="category">
          <Flex width="100%" align={"center"} gapX={"3"}>
            <Crosshair1Icon />
            <Text weight="bold">دسته بندی خاص</Text>
          </Flex>
        </RadioCards.Item>
        <RadioCards.Item value="low_stock">
          <Flex width="100%" align={"center"} gapX={"3"}>
            <ExclamationTriangleIcon />
            <Text weight="bold">فقط محصولات محدود</Text>
          </Flex>
        </RadioCards.Item>
        <RadioCards.Item value="selected">
          <Flex width="100%" align="center" gapX="3">
            <Crosshair1Icon />
            <Text weight="bold">محصولات انتخاب‌شده</Text>
          </Flex>
        </RadioCards.Item>
      </RadioCards.Root>

      {scope === "category" && (
        <Flex mt={"5"} direction={"column"} gapY={"3"}>
          <Text>دسته بندی</Text>
          <Select.Root
            size="3"
            value={categoryId != null ? String(categoryId) : undefined}
            onValueChange={(value) => onCategoryChange(Number(value))}
          >
            <Select.Trigger placeholder="انتخاب دسته بندی" />
            <Select.Content>
              {categories.map((category) => (
                <Select.Item key={category.id} value={String(category.id)}>
                  {category.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
      )}

      {scope === "selected" && (
        <Flex mt="5" direction="column" gap="2" className="max-h-64 overflow-y-auto rounded-xl border p-3">
          {products.map((product) => {
            const checked = selectedIds.includes(product.id);
            return (
              <Text as="label" key={product.id} className="flex items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onSelectedIdsChange(
                    value ? [...selectedIds, product.id] : selectedIds.filter((id) => id !== product.id),
                  )}
                />
                {product.custom_label || product.catalog_product?.name || `#${product.id}`}
              </Text>
            );
          })}
        </Flex>
      )}
    </Box>
  );
};

export default DataScope;
