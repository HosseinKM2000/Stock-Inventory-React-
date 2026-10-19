
import { Button } from "@/shared/ui/button/button";
import { TrashIcon } from "@radix-ui/react-icons";
import { Dialog, Flex } from "@radix-ui/themes";
import { useState } from "react";
import { useDeleteCategory } from "../../mutations/use-categories";
import type { Category } from "../../types";

type DeleteCategoryDialogProps = {
  category: Category;
};

const DeleteCategoryDialog = ({ category }: DeleteCategoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const deleteCategory = useDeleteCategory();

  const handleDelete = () => {
    deleteCategory.mutate(category.id, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button size={"2"} color="red">
          <TrashIcon width={"20"} height={"20"} />
        </Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title color="red">حذف دسته بندی</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          آیا از حذف «{category.name}» اطمینان دارید؟
        </Dialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              لغو
            </Button>
          </Dialog.Close>
          <Button
            color="red"
            loading={deleteCategory.isPending}
            onClick={handleDelete}
          >
            حذف
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default DeleteCategoryDialog;
