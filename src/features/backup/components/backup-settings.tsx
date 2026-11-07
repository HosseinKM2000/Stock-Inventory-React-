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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { useBackupStatus } from "../hooks/use-backup-status";
import { backupRestoreService, previewBackupFile } from "../services/backup-restore";
import { backupService } from "../services/backup-service";
import { chooseBackupFile, isPickerCancellation } from "../services/external-backup-adapter";
import { backupErrorMessage } from "../services/backup-error";
import type { BackupPreview, RecoveryReview, RecoveryReviewItem } from "../types";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { PageGuide } from "@/features/app/layout/page-guide";

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

function recoveryEntityLabel(entity: string) {
  return ({ product: "محصول", category: "دسته‌بندی", label: "برچسب", barcode: "بارکد", inventory_movement: "تغییر موجودی" } as Record<string, string>)[entity] ?? "رکورد بازیابی";
}

export function BackupSettings() {
  const { user } = useAuth();
  const status = useBackupStatus();
  const settings = status.settings;
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [review, setReview] = useState<RecoveryReview | null>(null);
  const [discardTarget, setDiscardTarget] = useState<RecoveryReviewItem | null>(null);

  const refreshReview = async () => {
    if (!user) return setReview(null);
    await backupRestoreService.resumeInterrupted(user);
    setReview(await backupRestoreService.getReview(user));
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      await backupRestoreService.resumeInterrupted(user);
      const next = await backupRestoreService.getReview(user);
      if (!cancelled) setReview(next);
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [user, settings?.restoreRequiresReview]);

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
    await refreshReview();
    toast.success("اطلاعات محلی بازیابی شد؛ پذیرش سرور هنوز نیازمند بررسی شماست.");
  });

  const resume = () => run(async () => {
    if (!user) return;
    await backupRestoreService.resumeSynchronization(user.id);
    await refreshReview();
    toast.success("همگام‌سازی دوباره فعال شد");
  });

  const applyItem = (item: RecoveryReviewItem) => run(async () => {
    if (!user) return;
    await backupRestoreService.applyReviewItem(user, item.id);
    await refreshReview();
    toast.success("درخواست برای بررسی سرور آماده شد.");
  });

  const discardItem = () => run(async () => {
    if (!user || !discardTarget) return;
    await backupRestoreService.discardReviewItem(user, discardTarget.id);
    setDiscardTarget(null);
    await refreshReview();
    toast.info("قصد بازیابی کنار گذاشته شد؛ این کار اثر احتمالی سرور را لغو نمی‌کند.");
  });

  const exportReview = () => run(async () => {
    if (!user) return;
    await backupRestoreService.exportRecovery(user);
    toast.success("مدرک بازیابی صادر شد و موارد اصلی حفظ شدند.");
  });

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-5xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="فایل پشتیبان محلی" description="یک نسخه تازه از اطلاعات قابل بازیابی مجموعه نگه دارید تا در صورت نیاز بتوانید آن‌ها را برگردانید. فایل را در محل مطمئن نگه دارید؛ این نسخه شامل رمز عبور یا اطلاعات ورود نیست." icon={ArchiveIcon} helpTopic="backup" />

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
          <Text as="p" size="2" color="gray" mt="1" className="leading-6">محل مطمئنی انتخاب کنید که بعداً هم به آن دسترسی داشته باشید. اگر دستگاه یا مرورگر را عوض کردید، ممکن است لازم باشد مقصد را دوباره انتخاب کنید.</Text>
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
          <Text as="p" size="2" color="gray" mt="1" className="leading-6">اگر ذخیره خودکار روشن باشد، برنامه در زمان‌های انتخابی بررسی می‌کند که نسخه تازه لازم است یا نه.</Text>
          <Separator size="4" my="4" />
          <Flex justify="between" align="center" gap="3">
            <Box><Text size="2" weight="medium">ذخیره خودکار</Text><Text as="div" size="1" color="gray">پس از بازگشت به برنامه، نیاز به نسخه تازه دوباره بررسی می‌شود.</Text></Box>
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
            <Text as="p" size="2" color="gray" mt="1" className="leading-6">پیش از جایگزینی، خلاصه فایل را با دقت بررسی کنید و از اطلاعات فعلی یک نسخه احتیاطی بگیرید. پس از بازیابی، چند محصول و کارهای در انتظار را کنترل کنید و سپس ادامه دهید.</Text>
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
          <Box mt="4">
            <Callout.Root color="amber">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>اطلاعات در این دستگاه بازیابی شده‌اند، اما هنوز به معنی پذیرش سرور نیستند. نقطهٔ بازگشت فقط در همین مرورگر نگه‌داری می‌شود.</Callout.Text>
            </Callout.Root>
            {review ? (
              <Card mt="3" variant="surface">
                <Flex justify="between" align="start" gap="3" wrap="wrap">
                  <Box>
                    <Heading as="h3" size="3">بررسی بازیابی ناتمام</Heading>
                    <Text as="div" size="2" color="gray" mt="1">
                      {review.session.imported.counts.products.toLocaleString("fa-IR")} رکورد محصول بازیابی شد؛ {review.session.currentWorkCount.toLocaleString("fa-IR")} کار فعلی پیش از بازیابی حفظ شد؛ {review.items.filter((item) => item.decision === "pending").length.toLocaleString("fa-IR")} تصمیم باقی مانده است.
                    </Text>
                    {review.session.imported.counts.unavailableImages > 0 ? <Text as="div" size="2" color="red" mt="1">{review.session.imported.counts.unavailableImages.toLocaleString("fa-IR")} تصویر در فایل موجود نبود و بازیابی‌شده محسوب نمی‌شود.</Text> : null}
                  </Box>
                  <Button variant="soft" loading={working} onClick={() => void exportReview()}>صدور مدرک بازیابی</Button>
                </Flex>
                <Box mt="3" className="max-h-80 overflow-y-auto overscroll-contain" tabIndex={0} aria-label="موارد نیازمند بررسی">
                  <Flex direction="column" gap="2">
                    {review.items.map((item) => (
                      <Box key={item.id} p="3" className="rounded-lg border border-[var(--gray-a6)]">
                        <Flex justify="between" align="center" gap="3" wrap="wrap">
                          <Box>
                            <Text as="div" size="2" weight="medium">{recoveryEntityLabel(item.entity)} شمارهٔ {item.entityId.toLocaleString("fa-IR")}</Text>
                            <Text as="div" size="1" color="gray">{item.classification === "never_attempted" ? "هنوز ارسال نشده" : item.classification === "snapshot" ? "رکورد داخل نسخه" : item.classification === "terminal" ? "ردشده و نیازمند نگه‌داری" : "نتیجهٔ ارسال نامشخص"}</Text>
                          </Box>
                          <Flex gap="2" align="center" wrap="wrap">
                            <Badge color={item.decision === "pending" ? "amber" : item.decision === "discarded" ? "gray" : "blue"}>{item.decision === "pending" ? "نیازمند تصمیم" : item.decision === "queued" ? "آمادهٔ ارسال" : item.decision === "resolved" ? "پذیرفته‌شده" : "کنار گذاشته‌شده"}</Badge>
                            {item.decision === "pending" && item.classification !== "terminal" && !(item.entity === "inventory_movement" && item.source === "backup_snapshot") ? <Button size="1" loading={working} onClick={() => void applyItem(item)}>اعمال با بررسی سرور</Button> : null}
                            {item.decision === "pending" ? <Button size="1" color="red" variant="soft" disabled={working} onClick={() => setDiscardTarget(item)}>کنار گذاشتن قصد</Button> : null}
                          </Flex>
                        </Flex>
                      </Box>
                    ))}
                  </Flex>
                </Box>
                <Flex justify="end" mt="3">
                  <Button className="w-full py-2 leading-6 sm:w-auto" style={{ whiteSpace: "normal", height: "auto" }} loading={working} disabled={review.items.some((item) => item.decision === "pending")} onClick={() => void resume()}>ارسال موارد تأییدشده و ادامهٔ همگام‌سازی</Button>
                </Flex>
              </Card>
            ) : <Text as="div" size="2" mt="3">در حال بازکردن بررسی ذخیره‌شده…</Text>}
          </Box>
        ) : null}
      </Card>

      <AlertDialog.Root open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <AlertDialog.Content maxWidth="520px" dir="rtl" className="max-h-[85vh] overflow-y-auto overscroll-contain">
          <AlertDialog.Title>تأیید بازیابی فایل پشتیبان</AlertDialog.Title>
          <AlertDialog.Description size="2" className="leading-7">
            اطلاعات فایل با وضعیت فعلی ادغام می‌شوند و کارهای محلی فعلی برای بررسی حفظ خواهند شد. پیش از ادامه، از وضعیت فعلی یک نسخهٔ احتیاطی بگیرید و خلاصهٔ فایل را بررسی کنید.
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
            <Button color="red" loading={working} onClick={() => void restore()}>بازیابی اطلاعات</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <AlertDialog.Root open={discardTarget !== null} onOpenChange={(open) => { if (!open) setDiscardTarget(null); }}>
        <AlertDialog.Content maxWidth="480px" dir="rtl" className="max-h-[85vh] overflow-y-auto overscroll-contain">
          <AlertDialog.Title>کنار گذاشتن قصد بازیابی؟</AlertDialog.Title>
          <AlertDialog.Description size="2" className="leading-7">این تصمیم فقط قصد محلی بازیابی را کنار می‌گذارد. اگر در گذشته درخواستی به سرور رسیده باشد، اثر آن لغو نمی‌شود. مدرک بازیابی و نقطهٔ بازگشت حذف نخواهند شد.</AlertDialog.Description>
          <Flex gap="3" mt="5" justify="end">
            <AlertDialog.Cancel><Button variant="soft" color="gray">بازگشت</Button></AlertDialog.Cancel>
            <Button color="red" loading={working} onClick={() => void discardItem()}>تأیید کنار گذاشتن</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
