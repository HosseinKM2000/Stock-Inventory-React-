import { Flex } from "@radix-ui/themes";
import { MixerHorizontalIcon, TrashIcon } from "@radix-ui/react-icons";

import { Button } from "@/shared/ui/button/button";

type Props = {
  selectedCount: number;
  deleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function BulkSelectionActions({
  selectedCount,
  deleting = false,
  onEdit,
  onDelete,
}: Props) {
  const localizedCount = selectedCount.toLocaleString("fa-IR");

  return (
    <Flex
      gap="2"
      align="center"
      className="fixed left-4 z-60 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6"
      aria-label="عملیات گروهی محصولات"
    >
      <Button
        type="button"
        color="red"
        variant="soft"
        aria-label={`حذف گروهی ${localizedCount} محصول`}
        className="h-14! rounded-full! px-5! shadow-xl"
        loading={deleting}
        onClick={onDelete}
      >
        <TrashIcon width="22" height="22" /> حذف
      </Button>
      <Button
        type="button"
        aria-label={`ویرایش گروهی ${localizedCount} محصول`}
        className="h-14! rounded-full! px-5! shadow-xl"
        onClick={onEdit}
      >
        <MixerHorizontalIcon width="22" height="22" /> ویرایش {localizedCount}
      </Button>
    </Flex>
  );
}
