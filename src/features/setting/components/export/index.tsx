import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { useSyncStatus } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { Button } from "@/shared/ui/button/button";
import { DownloadIcon, FaceIcon } from "@radix-ui/react-icons";
import { Box, Callout, Flex, Separator, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";

import {
  exportService,
  type ExportFormat,
  type ExportScope,
} from "../../services/export.service";
import DataScope from "./data-scope";
import FormatCads from "./file-format";

const ExportTools = () => {
  const online = useOnline();

  const { pending } = useSyncStatus();

  const [format, setFormat] = useState<ExportFormat>("xlsx");

  const [scope, setScope] = useState<ExportScope>("all");

  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [busy, setBusy] = useState<"local" | "server" | null>(null);

  const options = { format, scope, categoryId };

  const run = async (source: "local" | "server") => {
    setBusy(source);

    try {
      if (source === "local") {
        const count = await exportService.exportLocal(options);

        toast.success(`${count} محصول از داده های محلی خروجی گرفته شد`);
      } else {
        await exportService.exportServer(options);

        toast.success("خروجی سرور دریافت شد");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "خروجی گرفتن ناموفق بود",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box mt={"6"}>
      <Callout.Root>
        <Callout.Icon>
          <FaceIcon />
        </Callout.Icon>
        <Callout.Text size={"2"} className="text-right">
          می توانید قبل از گرفتن لیست محصولات, نوع فایل خروجی و بازه محصولات
          مدنظر را انتخاب کنید.
        </Callout.Text>
      </Callout.Root>
      <Separator size={"4"} mt={"3"} />
      <FormatCads value={format} onChange={setFormat} />
      <DataScope
        scope={scope}
        onScopeChange={setScope}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
      />

      {pending > 0 && (
        <Callout.Root color="amber" mt={"5"} dir="rtl">
          <Callout.Text size={"2"}>
            {pending} تغییر هنوز همگام نشده است؛ خروجی محلی و خروجی سرور می
            توانند متفاوت باشند.
          </Callout.Text>
        </Callout.Root>
      )}

      <Flex mt={"5"} direction={"column"} gapY={"3"}>
        <Button loading={busy === "local"} onClick={() => run("local")}>
          <DownloadIcon />
          خروجی داده های محلی
        </Button>

        <Button
          variant="soft"
          disabled={!online}
          loading={busy === "server"}
          onClick={() => run("server")}
        >
          <DownloadIcon />
          خروجی داده های سرور
        </Button>

        <Text size={"1"} color="gray" className="text-right">
          {online
            ? "خروجی محلی از داده های ذخیره شده روی این دستگاه و خروجی سرور از پایگاه داده تهیه می شود."
            : "در حالت آفلاین فقط خروجی داده های محلی در دسترس است."}
        </Text>
      </Flex>
    </Box>
  );
};

export default ExportTools;
