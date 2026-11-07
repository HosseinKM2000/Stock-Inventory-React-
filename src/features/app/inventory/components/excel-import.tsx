import { useRef, useState } from "react";
import { CheckCircledIcon, DownloadIcon, FileIcon, UploadIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Progress, Table, Text } from "@radix-ui/themes";
import { Button } from "@/shared/ui/button/button";
import { downloadImportTemplate, importProductRows, parseProductWorkbook, type ImportRow } from "../services/excel-import.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { PageGuide } from "@/features/app/layout/page-guide";

export function ExcelImport() {
  const input = useRef<HTMLInputElement>(null);
  const importing = useRef(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [complete, setComplete] = useState(false);
  const invalid = rows.filter((row) => row.errors.length > 0).length;

  const choose = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(null); setRows([]); setDone(0); setComplete(false); setFileName(file.name);
    try { setRows(await parseProductWorkbook(file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "خواندن فایل انجام نشد"); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!rows.length || invalid || importing.current) return;
    importing.current = true;
    setBusy(true); setError(null);
    try {
      await importProductRows(rows, setDone); setComplete(true); syncService.schedule();
    } catch (cause) { setError(`${done.toLocaleString("fa-IR")} ردیف ذخیره شد. ${cause instanceof Error ? cause.message : "ورود متوقف شد"}`); }
    finally { importing.current = false; setBusy(false); }
  };

  const reset = () => { setRows([]); setFileName(""); setDone(0); setComplete(false); setError(null); if (input.current) input.current.value = ""; };

  return (
    <Box dir="rtl" className="space-y-6">
      <PageGuide section="ابزارها" sectionTo="/tools" title="ورود از اکسل" description="فایل را روی همین دستگاه بررسی کنید، خطاها را پیش‌نمایش ببینید و محصولات را به‌صورت گروهی وارد کنید. پس از یک بار آماده‌شدن برنامه، این فرایند آفلاین هم کار می‌کند." icon={UploadIcon} />
      <Flex gap="3" wrap="wrap">
        {["۱. دریافت الگو و انتخاب فایل", "۲. بررسی ردیف‌ها", "۳. ذخیره محلی و همگام‌سازی"].map((step, index) => <Card key={step} className="grow"><Text color={(rows.length ? 1 : 0) >= index ? "violet" : "gray"} weight="medium">{step}</Text></Card>)}
      </Flex>
      <Card size="3">
        <Flex direction="column" align="center" gap="4" py="5">
          <Box className="card-empty-icon"><FileIcon width="26" height="26" /></Box>
          <Text align="center">ابتدا الگوی خالی را دریافت کنید و فقط ستون‌های مشخص‌شده را تکمیل کنید.</Text>
          <Flex gap="3" wrap="wrap" justify="center">
            <Button variant="soft" onClick={() => void downloadImportTemplate()}><DownloadIcon /> دریافت الگوی xlsx</Button>
            <Button loading={busy && !rows.length} onClick={() => input.current?.click()}><UploadIcon /> انتخاب فایل</Button>
          </Flex>
          <input ref={input} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void choose(event.target.files?.[0])} />
          {fileName && <Text size="2" color="gray">{fileName}</Text>}
        </Flex>
      </Card>
      {error && <Callout.Root color="red"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      {rows.length > 0 && !complete && <Card size="3">
        <Flex justify="between" align="center" gap="3" wrap="wrap"><Box><Text weight="bold">پیش‌نمایش {rows.length.toLocaleString("fa-IR")} ردیف</Text><Text as="div" size="2" color={invalid ? "red" : "green"}>{invalid ? `${invalid.toLocaleString("fa-IR")} ردیف نیاز به اصلاح دارد` : "همه ردیف‌ها معتبرند"}</Text></Box><Flex gap="2"><Button variant="soft" onClick={reset}>فایل دیگر</Button><Button disabled={invalid > 0} loading={busy} onClick={() => void commit()}>ورود محصولات</Button></Flex></Flex>
        {busy && <Box mt="4"><Progress value={rows.length ? done / rows.length * 100 : 0} /><Text size="2">{done.toLocaleString("fa-IR")} از {rows.length.toLocaleString("fa-IR")}</Text></Box>}
        <Box mt="4" className="max-h-96 overflow-auto"><Table.Root><Table.Header><Table.Row><Table.ColumnHeaderCell>ردیف</Table.ColumnHeaderCell><Table.ColumnHeaderCell>نام</Table.ColumnHeaderCell><Table.ColumnHeaderCell>تعداد</Table.ColumnHeaderCell><Table.ColumnHeaderCell>قیمت</Table.ColumnHeaderCell><Table.ColumnHeaderCell>وضعیت</Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>{rows.map((row) => <Table.Row key={row.row}><Table.Cell>{row.row}</Table.Cell><Table.Cell>{row.name || "—"}</Table.Cell><Table.Cell>{row.quantity}</Table.Cell><Table.Cell>{row.price.toLocaleString("fa-IR")}</Table.Cell><Table.Cell><Text color={row.errors.length ? "red" : "green"}>{row.errors.join("؛ ") || "آماده"}</Text></Table.Cell></Table.Row>)}</Table.Body></Table.Root></Box>
      </Card>}
      {complete && <Callout.Root color="green"><CheckCircledIcon /><Callout.Text>{done.toLocaleString("fa-IR")} محصول روی دستگاه ذخیره شد و برای همگام‌سازی آماده است.</Callout.Text><Button mt="3" variant="soft" onClick={reset}>ورود فایل دیگر</Button></Callout.Root>}
    </Box>
  );
}
