
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { TrashIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteCategory } from "../../mutations/use-categories";
import type { Category } from "../../types";

type DeleteCategoryDialogProps = {
  category: Category;
};

const DeleteCategoryDialog = ({ category }: DeleteCategoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const deleteCategory = useDeleteCategory();

  const handleDelete = () => {
    deleteCategory.mutate(category.id, {
      onSuccess: () => {
        setOpen(false);
        toast.success(`دسته‌بندی «${category.name}» حذف شد`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "حذف دسته‌بندی ناموفق بود");
      },
    });
  };

  return (
    <>
      <Button
        size="2"
        color="red"
        aria-label={`حذف دسته‌بندی ${category.name}`}
        onClick={() => setOpen(true)}
      >
        <TrashIcon width="20" height="20" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="حذف دسته‌بندی؟"
        description={`«${category.name}» از فهرست دسته‌بندی‌ها حذف می‌شود.`}
        confirmLabel="حذف"
        cancelLabel="لغو"
        variant="danger"
        loading={deleteCategory.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default DeleteCategoryDialog;
