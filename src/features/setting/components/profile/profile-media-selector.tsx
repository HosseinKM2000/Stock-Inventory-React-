import { Button } from "@/shared/ui/button/button";
import { IMAGE_LIMITS } from "@/shared/lib/infrastructure/media/image.constants";
import { ImageValidationError } from "@/shared/lib/infrastructure/media/image.validation";
import { profileAvatarRegistry } from "@/shared/profile-media/profile-avatar-registry";
import { profileMediaService } from "@/shared/profile-media/profile-media.service";
import { useProfileMedia } from "@/shared/profile-media/use-profile-media";
import { Cross2Icon, ImageIcon, UploadIcon } from "@radix-ui/react-icons";
import { AlertDialog, Avatar, Box, Callout, Card, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import { useRef, useState } from "react";
import { toast } from "sonner";

function reportImageError(error: unknown) {
  if (!(error instanceof ImageValidationError)) {
    console.error("Profile media operation failed", error);
  }
  toast.error(
    error instanceof ImageValidationError
      ? error.message
      : "ذخیره تصویر پروفایل ناموفق بود. دوباره تلاش کنید.",
  );
}

export function ProfileMediaSelector() {
  const { selection, src, imageLoading, imageError } = useProfileMedia();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await profileMediaService.selectCustom(file);
      toast.success("تصویر پروفایل روی این دستگاه ذخیره شد.");
    } catch (error) {
      reportImageError(error);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const chooseAvatar = async (avatarId: (typeof profileAvatarRegistry)[number]["id"]) => {
    setBusy(true);
    try {
      await profileMediaService.selectAvatar(avatarId);
    } catch (error) {
      reportImageError(error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await profileMediaService.remove();
      toast.success("تصویر پروفایل حذف شد.");
    } catch (error) {
      reportImageError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card mt="6" className="overflow-hidden rounded-2xl border border-foreground/20 bg-foreground/5">
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />

      <Flex direction={{ initial: "column", sm: "row" }} align="center" gap="4" p={{ initial: "3", sm: "4" }}>
        <Box className="relative shrink-0">
          <Avatar size="8" radius="full" src={src} fallback={<ImageIcon width="30" height="30" />} />
          {imageLoading && <Flex align="center" justify="center" className="absolute inset-0 rounded-full bg-background/70"><Spinner /></Flex>}
        </Box>
        <Box className="min-w-0 flex-1 text-center sm:text-right">
          <Text as="div" size="4" weight="bold">تصویر پروفایل</Text>
          <Text as="div" size="2" color="gray" mt="1">
            کاملاً محلی و آفلاین؛ حداکثر {(IMAGE_LIMITS.profile.maxInputSize / 1024 / 1024).toLocaleString("fa-IR")} مگابایت
          </Text>
          <Flex gap="2" mt="3" wrap="wrap" justify={{ initial: "center", sm: "start" }}>
            <Button type="button" variant="soft" loading={busy} onClick={() => inputRef.current?.click()}>
              <UploadIcon />
              {selection.kind === "custom" ? "تغییر تصویر" : "انتخاب تصویر"}
            </Button>
            {selection.kind !== "initials" && (
              <AlertDialog.Root>
                <AlertDialog.Trigger>
                  <Button type="button" color="red" variant="soft" disabled={busy}><Cross2Icon />حذف</Button>
                </AlertDialog.Trigger>
                <AlertDialog.Content maxWidth="420px" dir="rtl">
                  <AlertDialog.Title>حذف تصویر پروفایل</AlertDialog.Title>
                  <AlertDialog.Description size="2">تصویر یا آواتار انتخاب‌شده حذف شود؟</AlertDialog.Description>
                  <Flex gap="3" mt="4" justify="end">
                    <AlertDialog.Cancel><Button variant="soft" color="gray">انصراف</Button></AlertDialog.Cancel>
                    <AlertDialog.Action><Button color="red" onClick={() => void remove()}>حذف</Button></AlertDialog.Action>
                  </Flex>
                </AlertDialog.Content>
              </AlertDialog.Root>
            )}
          </Flex>
        </Box>
      </Flex>

      {imageError && (
        <Callout.Root color="red" mx={{ initial: "3", sm: "4" }} mb="4">
          <Callout.Text>خواندن تصویر محلی ناموفق بود. می‌توانید آن را حذف یا جایگزین کنید.</Callout.Text>
        </Callout.Root>
      )}

      <Box className="border-t border-foreground/10 p-3 sm:p-4">
        <Text as="div" size="2" weight="medium">یا انتخاب آواتار کاری</Text>
        <Grid columns={{ initial: "3", sm: "5" }} gap="3" mt="3">
          {profileAvatarRegistry.map((avatar) => {
            const selected = selection.kind === "avatar" && selection.avatarId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                disabled={busy}
                aria-label={`انتخاب آواتار ${avatar.label}`}
                aria-pressed={selected}
                onClick={() => void chooseAvatar(avatar.id)}
                className={`min-w-0 rounded-xl border p-2 py-5 transition-[border-color,background-color,transform] active:scale-95 disabled:opacity-60 ${selected ? "border-violet-500 bg-violet-500/10" : "border-foreground/10 hover:bg-foreground/5"}`}
              >
                <Avatar src={avatar.src} fallback="" radius="medium" size="4" className="mx-auto" />
                <Text as="div" size="1" mt="1" className="truncate">{avatar.label}</Text>
              </button>
            );
          })}
        </Grid>
      </Box>
    </Card>
  );
}
