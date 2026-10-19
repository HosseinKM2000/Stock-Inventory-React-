import { useState } from "react";

import { TrashIcon } from "@radix-ui/react-icons";

import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";

import { useDeleteIndustry } from "../../mutations/use-industry";
import type { Industry } from "../../types";

type Props = {
  industry: Industry;
};

export default function DeleteIndustryDialog({
  industry,
}: Props) {
  const [open, setOpen] = useState(false);

  const deleteMutation =
    useDeleteIndustry();

  function handleDelete() {
    deleteMutation.mutate(industry.id, {
      onSuccess() {
        setOpen(false);
      },
    });
  }

  return (
    <>
      <Button color="red" size="2" onClick={() => setOpen(true)} aria-label={`حذف حوزه کاری ${industry.name}`}>
        <TrashIcon />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="حذف حوزه کاری"
        description={`حوزه کاری «${industry.name}» حذف می‌شود. اگر محصول کاتالوگی به آن وابسته باشد، سرور از حذف جلوگیری خواهد کرد.`}
        confirmLabel="حذف حوزه کاری"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
