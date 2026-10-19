import { ArchiveIcon } from "@radix-ui/react-icons";
import { Dialog, Flex, IconButton, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button/button";
import { useBackupStatus } from "../hooks/use-backup-status";
import { backupService } from "../services/backup-service";
import { backupErrorMessage } from "../services/backup-error";

const EXPLANATION = "برای اطمینان بیشتر، یک نسخه از اطلاعات تنظیم را روی دستگاه خودتان ذخیره کنید تا در صورت نیاز بتوانید آن را بازیابی کنید.";
const UNSUPPORTED = "در این مرورگر، ذخیره خودکار فایل پشتیبان پشتیبانی نمی‌شود.";

export function BackupShortcut() {
  const status = useBackupStatus();
  const [open, setOpen] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const settings = status.settings;

  const save = async () => {
    try {
      const result = await backupService.saveNow({ interactive: true });
      if (result === "saved") toast.success("فایل پشتیبان به‌روز شد");
      if (result === "unchanged") toast.info("فایل پشتیبان به‌روز است");
      if (result === "permission_required") toast.warning("برای ادامه، دسترسی فایل پشتیبان را دوباره تأیید کنید");
    } catch (error) {
      toast.error(backupErrorMessage(error, "ذخیره فایل پشتیبان ناموفق بود"));
    }
  };

  const onShortcut = () => {
    if (status.busy) return;
    if (!settings?.onboardingCompleted) {
      setOpen(true);
      return;
    }
    void save();
  };

  const setup = async () => {
    setSettingUp(true);
    try {
      const result = await backupService.setup();
      if (result === "cancelled") {
        setOpen(false);
        return;
      }
      if (result === "saved") toast.success("اولین فایل پشتیبان ذخیره شد");
      setOpen(false);
    } catch (error) {
      toast.error(backupErrorMessage(error, "راه‌اندازی فایل پشتیبان ناموفق بود"));
    } finally {
      setSettingUp(false);
    }
  };

  const label = status.dirty
    ? "فایل پشتیبان؛ تغییرات ذخیره‌نشده وجود دارد"
    : "فایل پشتیبان محلی";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <IconButton
        size="3"
        variant="ghost"
        color="gray"
        aria-label={label}
        aria-busy={status.busy}
        onClick={onShortcut}
        disabled={status.busy}
      >
        <span className="relative inline-flex h-5.5 w-5.5 items-center justify-center">
          <ArchiveIcon width="22" height="22" />
          {status.dirty ? (
            <span
              className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-9 ring-2 ring-[var(--color-panel-solid)]"
              aria-hidden="true"
            />
          ) : null}
        </span>
      </IconButton>
      <Dialog.Content dir="rtl" maxWidth="440px">
        <Dialog.Title>فایل پشتیبان محلی</Dialog.Title>
        <Dialog.Description size="2" color="gray" className="leading-7">
          {EXPLANATION}
        </Dialog.Description>
        {settings?.mode === "manual" ? (
          <Text as="p" size="2" color="amber" mt="3">{UNSUPPORTED}</Text>
        ) : null}
        <Flex gap="3" mt="5" justify="end" wrap="wrap">
          <Dialog.Close>
            <Button variant="soft" color="gray">فعلاً نه</Button>
          </Dialog.Close>
          <Button loading={settingUp} onClick={() => void setup()}>
            ذخیره فایل پشتیبان
          </Button>
        </Flex>
        <Text as="div" size="1" color="gray" mt="4">
          جزئیات و بازیابی از <Link to="/setting/backup" onClick={() => setOpen(false)}>تنظیمات فایل پشتیبان</Link> در دسترس است.
        </Text>
      </Dialog.Content>
    </Dialog.Root>
  );
}
