import { Button } from "@/shared/ui/button/button";
import { LayersIcon, PlusIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import CategoryFormDialog from "./category-form-dialog";
import DeleteCategoryDialog from "./delete-category-dialog";
import {
  useCategories,
  useRefreshCategoriesFromServer,
} from "../../mutations/use-categories";
import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";

const CategoriesCards = () => {
  const { data: categories = [], isLoading, isError, error } = useCategories();
  const online = useOnline();
  const [refreshOpen, setRefreshOpen] = useState(false);
  const refreshMutation = useRefreshCategoriesFromServer();

  const refresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      setRefreshOpen(false);
      toast.success("دسته‌بندی‌های محلی از سرور تازه‌سازی شدند");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "تازه‌سازی دسته‌بندی‌ها ناموفق بود",
      );
    }
  };

  return (
    <Box className="space-y-6">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="6" weight="bold">
          دسته بندی ها
        </Text>

        <Flex gap="2" wrap="wrap" className="w-full sm:w-auto">
          <Button
            variant="soft"
            disabled={!online}
            loading={refreshMutation.isPending}
            onClick={() => setRefreshOpen(true)}
          >
            <ReloadIcon /> تازه‌سازی از سرور
          </Button>
          <CategoryFormDialog
            mode="create"
            trigger={
              <Button>
                <PlusIcon />
                افزودن دسته بندی
              </Button>
            }
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
            <Box className="card-empty-icon" aria-hidden="true">
              <LayersIcon width="26" height="26" />
            </Box>
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
                <Flex align="center" gap="3">
                  <Flex
                    align="center"
                    justify="center"
                    aria-hidden="true"
                    className="card-title-icon"
                  >
                    <LayersIcon width="20" height="20" />
                  </Flex>
                  <Text as="div" size="2" weight="bold">
                    {category.name}
                  </Text>
                </Flex>
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
      <ConfirmDialog
        open={refreshOpen}
        onOpenChange={setRefreshOpen}
        title="تازه‌سازی دسته‌بندی‌ها از سرور"
        description="ابتدا تغییرات محلی همگام می‌شوند؛ سپس نسخه معتبر دسته‌بندی‌های سرور به‌صورت یکجا جایگزین نسخه محلی می‌شود."
        confirmLabel="تازه‌سازی از سرور"
        variant="warning"
        loading={refreshMutation.isPending}
        onConfirm={() => { void refresh(); }}
      />
    </Box>
  );
};

export default CategoriesCards;
