import { useState } from "react";

import { Dialog, Flex } from "@radix-ui/themes";

import { TrashIcon } from "@radix-ui/react-icons";

import { Button } from "@/shared/ui/button/button";

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
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
    >
      <Dialog.Trigger>
        <Button
          color="red"
          size="2"
        >
          <TrashIcon />
        </Button>
      </Dialog.Trigger>

      <Dialog.Content
        maxWidth="420px"
      >
        <Dialog.Title color="red">
          حذف حوزه کاری
        </Dialog.Title>

        <Dialog.Description mt="3">
          آیا از حذف
          <strong>
            {" "}
            {industry.name}{" "}
          </strong>
          اطمینان دارید؟
        </Dialog.Description>

        <Flex
          justify="end"
          gap="3"
          mt="6"
        >
          <Dialog.Close>
            <Button
              variant="soft"
              color="gray"
            >
              لغو
            </Button>
          </Dialog.Close>

          <Button
            color="red"
            loading={
              deleteMutation.isPending
            }
            onClick={handleDelete}
          >
            حذف
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}