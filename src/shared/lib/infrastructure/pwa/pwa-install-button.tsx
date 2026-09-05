import { DownloadIcon } from "@radix-ui/react-icons";
import { Dialog, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button/button";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function usePwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const iosInstructionsAvailable = isIosBrowser() && !installed;

  const install = async () => {
    if (!promptEvent) {
      setInstructionsOpen(true);
      return;
    }
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  return {
    available: !installed && Boolean(promptEvent || iosInstructionsAvailable),
    instructionsOpen,
    setInstructionsOpen,
    install,
  };
}

type PwaInstallController = ReturnType<typeof usePwaInstallPrompt>;

type Props = {
  presentation?: "icon" | "menu";
  controller: PwaInstallController;
};

export function PwaInstallButton({
  presentation = "icon",
  controller,
}: Props) {
  if (!controller.available) return null;

  const { instructionsOpen, setInstructionsOpen, install } = controller;

  return (
    <Dialog.Root open={instructionsOpen} onOpenChange={setInstructionsOpen}>
      {presentation === "menu" ? (
        <Button
          size="3"
          color="violet"
          variant="soft"
          className="pwa-install-menu-button mt-3 min-h-12 w-full! justify-start!"
          aria-label="افزودن برنامه به دستگاه"
          onClick={() => { void install(); }}
        >
          <DownloadIcon width="20" height="20" />
          افزودن برنامه به دستگاه
        </Button>
      ) : (
        <Tooltip content="افزودن تنظیم به دستگاه">
          <IconButton
            size="3"
            color="violet"
            variant="soft"
            aria-label="افزودن برنامه به دستگاه"
            onClick={() => { void install(); }}
          >
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      )}
      <Dialog.Content maxWidth="420px" dir="rtl">
        <Dialog.Title>افزودن به صفحه اصلی</Dialog.Title>
        <Dialog.Description>
          در Safari دکمه اشتراک‌گذاری را بزنید و سپس «Add to Home Screen» را انتخاب کنید. این مرورگر نصب خودکار را در اختیار برنامه قرار نمی‌دهد.
        </Dialog.Description>
        <Flex justify="end" mt="5">
          <Dialog.Close><Button>متوجه شدم</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
