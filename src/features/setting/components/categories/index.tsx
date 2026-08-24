import { Button } from "@/shared/ui/button/button";
import { PlusIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import CategoryFormDialog from "./category-form-dialog";
import DeleteCategoryDialog from "./delete-category-dialog";
import { useCategories } from "../../mutations/use-categories";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { toast } from "sonner";

const CategoriesCards = () => {
  const { data: categories = [], isLoading, isError, error } = useCategories();
  const online = useOnline();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncService.sync();
      toast.success("دسته‌بندی‌ها با سرور همگام شدند");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Box className="space-y-6">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="6" weight="bold">
          دسته بندی ها
        </Text>

        <Flex gap="2" wrap="wrap" className="w-full sm:w-auto">
          <Button variant="soft" disabled={!online} loading={refreshing} onClick={refresh}>
            <ReloadIcon /> تازه‌سازی از سرور
          </Button>
          <CategoryFormDialog
            mode="create"
            trigger={<Button><PlusIcon />افزودن دسته بندی</Button>}
          />
        </Flex>
      </Flex>

      {isLoading && (
        <Flex justify="center" align="center" height="300px">
          <Spinner size="3" />
        </Flex>
      )}

      {isError && (
        <Callout.Root color="red">
          <Callout.Text>
            {error instanceof Error ? error.message : "خطا در دریافت دسته بندی"}
          </Callout.Text>
        </Callout.Root>
      )}

      {!isLoading && !isError && categories.length === 0 && (
        <Card>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            py="8"
          >
            <Text size="4" weight="medium">
              هنوز هیچ دسته بندی ثبت نشده است!
            </Text>

            <Text color="gray" size="2">
              اولین دسته بندی را ایجاد کنید.
            </Text>
          </Flex>
        </Card>
      )}

      {!isLoading && !isError && categories.length > 0 && (
        <Flex mt={"6"} wrap={"wrap"} gap={"5"}>
          {categories.map((category) => (
            <Card
              key={category.id}
              className="flex! h-32 w-full flex-col justify-between md:w-[calc(50%-10px)] xl:w-[calc(33.333%-14px)]"
            >
              <Box>
                <Text as="div" size="2" weight="bold">
                  {category.name}
                </Text>
                <Text
                  as="div"
                  mt={"1"}
                  color="gray"
                  size="2"
                  className="line-clamp-1"
                >
                  {category.description || "بدون توضیحات"}
                </Text>
              </Box>
              <Flex mt={"3"} align={"center"} gapX={"3"} justify={"end"}>
                <CategoryFormDialog
                  mode="edit"
                  category={category}
                  trigger={
                    <Button size={"2"} color="amber" variant="surface">
                      ویرایش
                    </Button>
                  }
                />
                <DeleteCategoryDialog category={category} />
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Box>
  );
};

export default CategoriesCards;
