import {
  ArchiveIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  FileIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import {
  AlertDialog,
  Badge,
  Box,
  Callout,
  Card,
  Flex,
  Grid,
  Heading,
  Select,
  Separator,
  Switch,
  Text,
} from "@radix-ui/themes";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { useBackupStatus } from "../hooks/use-backup-status";
import { backupRestoreService, previewBackupFile } from "../services/backup-restore";
import { backupService } from "../services/backup-service";
import { chooseBackupFile, isPickerCancellation } from "../services/external-backup-adapter";
import { backupErrorMessage } from "../services/backup-error";
import type { BackupPreview } from "../types";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";

const UNSUPPORTED = "در این مرورگر، ذخیره خودکار فایل پشتیبان پشتیبانی نمی‌شود.";

function dateTime(value: number | string | null | undefined) {
  if (!value) return "هنوز انجام نشده";
  return formatJalaliDateTime(value);
}

function permissionLabel(permission: string | undefined) {
  if (permission === "granted") return "دسترسی برقرار است";
  if (permission === "prompt") return "نیازمند تأیید دوباره";
  if (permission === "denied") return "دسترسی رد شده است";
  if (permission === "unsupported") return "ذخیره دستی";
  return "مقصد انتخاب نشده";
}

export function BackupSettings() {
  const { user } = useAuth();
  const status = useBackupStatus();
  const settings = status.settings;
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  const run = async (operation: () => Promise<void>) => {
    setWorking(true);
    try {
      await operation();
    } catch (error) {
      if (!isPickerCancellation(error)) {
        toast.error(backupErrorMessage(error));
      }
    } finally {
      setWorking(false);
    }
  };

  const saveNow = () => run(async () => {
    const result = settings?.onboardingCompleted
      ? await backupService.saveNow({ interactive: true, force: true })
      : await backupService.setup();
    if (result === "saved") toast.success("فایل پشتیبان با موفقیت ذخیره شد");
    else if (result === "unchanged") toast.info("فایل پشتیبان به‌روز است");
    else if (result === "permission_required") toast.warning("دسترسی مقصد را دوباره تأیید کنید");
  });

  const reconnect = () => run(async () => {
    if (await backupService.reconnect()) toast.success("مقصد فایل پشتیبان به‌روز شد");
  });

  const inspectFile = (file: File | null) => run(async () => {
    if (!file || !user) return;
    setPreview(await previewBackupFile(file, user.id, user.store_id ?? user.id));
  });

  const chooseRestoreFile = () => run(async () => {
    if (!user) return;
    const file = await chooseBackupFile();
    if (file) setPreview(await previewBackupFile(file, user.id, user.store_id ?? user.id));
    else inputRef.current?.click();
  });

  const inspectConnected = () => run(async () => {
    if (!user) return;
    setPreview(await backupRestoreService.previewConnected(user));
  });

  const restore = () => run(async () => {
    if (!preview || !user) return;
    await backupRestoreService.apply(preview, user);
    setPreview(null);
    toast.success("بازیابی کامل شد؛ همگام‌سازی تا پایان بررسی شما متوقف می‌ماند");
  });

  const resume = () => run(async () => {
    if (!user) return;
    await backupRestoreService.resumeSynchronization(user.id);
    toast.success("همگام‌سازی دوباره فعال شد");
  });

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-5xl">
      <Flex align="center" gap="3" mb="2">
        <ArchiveIcon width="26" height="26" />
        <Heading as="h1" size="6">فایل پشتیبان محلی</Heading>
      </Flex>
      <Text as="p" size="2" color="gray" className="max-w-3xl leading-7">
        یک نسخه کامل و رمزنگاری‌نشده از داده‌های قابل بازیابی حساب روی دستگاه خود نگه دارید. این فایل شامل رمز عبور، توکن ورود یا نقش‌های دسترسی نیست.
      </Text>

      <Card mt="5" size="3">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Box>
            <Flex align="center" gap="2">
              {status.dirty ? <ExclamationTriangleIcon color="var(--red-9)" /> : <CheckCircledIcon color="var(--green-9)" />}
              <Text weight="bold">{status.dirty ? "تغییرات ذخیره‌نشده وجود دارد" : "نسخه پشتیبان به‌روز است"}</Text>
            </Flex>
            <Text as="div" size="1" color="gray" mt="1">آخرین ذخیره موفق: {dateTime(settings?.lastSuccessfulAt)}</Text>
          </Box>
          <Button loading={working || status.busy} onClick={() => void saveNow()} leftIcon={<FileIcon />}>
            ذخیره اکنون
          </Button>
        </Flex>
        {settings?.lastFailure ? (
          <Callout.Root color="red" mt="4"><Callout.Icon><ExclamationTriangleIcon /></Callout.Icon><Callout.Text>{backupErrorMessage(new Error(settings.lastFailure))}</Callout.Text></Callout.Root>
        ) : null}
      </Card>

      <Grid columns={{ initial: "1", md: "2" }} gap="4" mt="4">
        <Card size="3">
          <Heading as="h2" size="4">مقصد ذخیره</Heading>
          <Text as="p" size="2" color="gray" mt="1" className="leading-6">فایل متصل در همان مقصد به‌روزرسانی می‌شود و در پوشه‌ها، نسخه قبلی نیز نگه‌داری خواهد شد. پس از پاک‌شدن داده‌های مرورگر یا نصب دوباره برنامه، ممکن است لازم باشد فایل بیرونی را دوباره انتخاب کنید.</Text>
          <Separator size="4" my="4" />
          <Flex direction="column" gap="3">
            <Flex justify="between" gap="3"><Text size="2" color="gray">روش</Text><Badge>{settings?.mode === "manual" ? "دستی" : settings?.mode === "directory" ? "پوشه" : "فایل"}</Badge></Flex>
            <Flex justify="between" gap="3"><Text size="2" color="gray">مقصد</Text><Text size="2" className="max-w-[65%] break-all text-left">{settings?.destinationName ?? "انتخاب نشده"}</Text></Flex>
            <Flex justify="between" gap="3"><Text size="2" color="gray">مجوز</Text><Text size="2">{permissionLabel(settings?.permission)}</Text></Flex>
          </Flex>
          {settings?.mode === "manual" ? <Callout.Root color="amber" mt="4"><Callout.Icon><ExclamationTriangleIcon /></Callout.Icon><Callout.Text>{UNSUPPORTED}</Callout.Text></Callout.Root> : null}
          <Button variant="soft" mt="4" loading={working} onClick={() => void reconnect()}>انتخاب یا اتصال دوباره مقصد</Button>
        </Card>

        <Card size="3">
          <Heading as="h2" size="4">زمان‌بندی</Heading>
          <Text as="p" size="2" color="gray" mt="1" className="leading-6">فقط وقتی داده‌ها تغییر کرده‌اند، نسخه جدید نوشته می‌شود. مرورگر در پس‌زمینه بدون مجوز تازه درخواست نشان نمی‌دهد.</Text>
          <Separator size="4" my="4" />
          <Flex justify="between" align="center" gap="3">
            <Box><Text size="2" weight="medium">ذخیره خودکار</Text><Text as="div" size="1" color="gray">پس از بازگشت به برنامه نیز زمان عقب‌افتاده بررسی می‌شود.</Text></Box>
            <Switch
              checked={settings?.automaticEnabled ?? false}
              disabled={!settings || settings.mode === "manual" || working}
              onCheckedChange={(checked) => void run(async () => { await backupService.updateSettings({ automaticEnabled: checked }); })}
            />
          </Flex>
          <Flex justify="between" align="center" gap="3" mt="4">
            <Text size="2">فاصله بررسی</Text>
            <Select.Root
              value={String(settings?.intervalMs ?? 300000)}
              disabled={!settings || settings.mode === "manual" || working}
              onValueChange={(value) => void run(async () => { await backupService.updateSettings({ intervalMs: Number(value) }); })}
            >
              <Select.Trigger aria-label="فاصله ذخیره خودکار" />
              <Select.Content>
                <Select.Item value="300000">۵ دقیقه</Select.Item>
                <Select.Item value="900000">۱۵ دقیقه</Select.Item>
                <Select.Item value="1800000">۳۰ دقیقه</Select.Item>
                <Select.Item value="3600000">۶۰ دقیقه</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Card>
      </Grid>

      <Card mt="4" size="3">
        <Flex justify="between" align="start" gap="4" wrap="wrap">
          <Box className="max-w-2xl">
            <Heading as="h2" size="4">بازیابی</Heading>
            <Text as="p" size="2" color="gray" mt="1" className="leading-6">پیش از جایگزینی، مالک فایل، سلامت آن و تعداد رکوردها بررسی می‌شود. از وضعیت فعلی یک نسخه نجات ساخته می‌شود و عملیات قدیمی بدون بررسی دوباره ارسال نخواهند شد. بازیابی آفلاین مجاز است، اما همگام‌سازی تا اتصال و تأیید شما متوقف می‌ماند.</Text>
          </Box>
          <Flex gap="2" wrap="wrap">
            {settings?.mode !== "manual" && settings?.handle ? <Button variant="soft" loading={working} onClick={() => void inspectConnected()} leftIcon={<ReloadIcon />}>بررسی نسخه متصل</Button> : null}
            <Button variant="soft" loading={working} onClick={() => void chooseRestoreFile()} leftIcon={<FileIcon />}>انتخاب فایل دیگر</Button>
            <input
              ref={inputRef}
              type="file"
              accept=".tanzimbackup,application/json,application/vnd.tanzim.backup+json"
              className="hidden"
              onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ""; void inspectFile(file); }}
            />
          </Flex>
        </Flex>
        {settings?.restoreRequiresReview ? (
          <Callout.Root color="amber" mt="4">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>
              همگام‌سازی پس از بازیابی متوقف است. داده‌ها و تعارض‌های صف را بررسی کنید.
              <Button size="2" variant="soft" ml="2" loading={working} onClick={() => void resume()}>بررسی شد؛ ادامه همگام‌سازی</Button>
            </Callout.Text>
          </Callout.Root>
        ) : null}
      </Card>

      <AlertDialog.Root open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <AlertDialog.Content maxWidth="520px" dir="rtl">
          <AlertDialog.Title>تأیید بازیابی فایل پشتیبان</AlertDialog.Title>
          <AlertDialog.Description size="2" className="leading-7">
            داده‌های فعلی این حساب جایگزین می‌شوند. پیش از بازیابی، یک نسخه نجات از وضعیت فعلی دریافت خواهید کرد.
          </AlertDialog.Description>
          {preview ? (
            <Box mt="4" p="3" className="rounded-lg bg-[var(--gray-a3)]">
              <Text as="div" size="2">فایل: {preview.sourceName}</Text>
              <Text as="div" size="2" mt="1">زمان نسخه: {dateTime(preview.envelope.createdAt)}</Text>
              <Text as="div" size="2" mt="1">{preview.envelope.counts.products.toLocaleString("fa-IR")} محصول، {preview.envelope.counts.categories.toLocaleString("fa-IR")} دسته، {preview.envelope.counts.images.toLocaleString("fa-IR")} تصویر</Text>
            </Box>
          ) : null}
          <Flex gap="3" mt="5" justify="end">
            <AlertDialog.Cancel><Button variant="soft" color="gray">انصراف</Button></AlertDialog.Cancel>
            <Button color="red" loading={working} onClick={() => void restore()}>ساخت نسخه نجات و بازیابی</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
