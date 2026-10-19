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
      className="bulk-selection-actions fixed z-60"
      aria-label="عملیات گروهی محصولات"
    >
      {onPrint ? <Button
        type="button"
        color="green"
        variant="outline"
        aria-label={`چاپ لیبل ${localizedCount} محصول`}
        className="bulk-selection-button"
        onClick={onPrint}
      >
        <ReaderIcon width="18" height="18" /><span>چاپ لیبل</span>
      </Button> : null}
      <Button
        type="button"
        color="red"
        variant="soft"
        aria-label={`حذف گروهی ${localizedCount} محصول`}
        className="bulk-selection-button"
        loading={deleting}
        onClick={onDelete}
      >
        <TrashIcon width="18" height="18" /><span>حذف</span>
      </Button>
      <Button
        type="button"
        aria-label={`ویرایش گروهی ${localizedCount} محصول`}
        className="bulk-selection-button"
        onClick={onEdit}
      >
        <MixerHorizontalIcon width="18" height="18" /><span>ویرایش {localizedCount}</span>
      </Button>
    </Flex>
  );
}
