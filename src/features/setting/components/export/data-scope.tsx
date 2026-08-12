import type { ExportScope } from "@/features/setting/services/export.service";
import {
  Crosshair1Icon,
  ExclamationTriangleIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import { Box, Flex, RadioCards, Select, Text } from "@radix-ui/themes";

import { useCategories } from "@/features/setting/mutations/use-categories";

type DataScopeProps = {
  scope: ExportScope;

  onScopeChange(scope: ExportScope): void;

  categoryId: number | null;

  onCategoryChange(categoryId: number | null): void;
};

const DataScope = ({
  scope,
  onScopeChange,
  categoryId,
  onCategoryChange,
}: DataScopeProps) => {
  // Category names come from the API; offline the list is simply empty and the
  // user can still export every product locally.
  const { data: categories = [] } = useCategories();

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
    </Box>
  );
};

export default DataScope;
