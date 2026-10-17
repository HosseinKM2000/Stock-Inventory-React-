import { Flex } from "@radix-ui/themes";
import { MixerHorizontalIcon, ReaderIcon, TrashIcon } from "@radix-ui/react-icons";

import { Button } from "@/shared/ui/button/button";

type Props = {
  selectedCount: number;
  deleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPrint?: () => void;
};

export function BulkSelectionActions({
  selectedCount,
  deleting = false,
  onEdit,
  onDelete,
  onPrint,
}: Props) {
  const localizedCount = selectedCount.toLocaleString("fa-IR");

  return (
    <Flex
      gap="2"
      align="center"
      className="bulk-selection-actions fixed left-4 z-60"
      aria-label="عملیات گروهی محصولات"
    >
      {onPrint ? <Button
        type="button"
        color="green"
        variant="outline"
        aria-label={`چاپ لیبل ${localizedCount} محصول`}
        className="h-14! rounded-full! px-5!"
        onClick={onPrint}
      >
        <ReaderIcon width="22" height="22" /> چاپ لیبل
      </Button> : null}
      <Button
        type="button"
        color="red"
        variant="soft"
        aria-label={`حذف گروهی ${localizedCount} محصول`}
        className="h-14! rounded-full! px-5!"
        loading={deleting}
        onClick={onDelete}
      >
        <TrashIcon width="22" height="22" /> حذف
      </Button>
      <Button
        type="button"
        aria-label={`ویرایش گروهی ${localizedCount} محصول`}
        className="h-14! rounded-full! px-5!"
        onClick={onEdit}
      >
        <MixerHorizontalIcon width="22" height="22" /> ویرایش {localizedCount}
      </Button>
    </Flex>
  );
}
