import { Cross1Icon, DownloadIcon } from "@radix-ui/react-icons";
import { Callout, Dialog, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button/button";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALL_PROMOTION_DISMISSED_KEY = "tanzim-pwa-install-promotion-dismissed-v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function wasDismissed() {
  try {
    return localStorage.getItem(INSTALL_PROMOTION_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function recordDismissal() {
  try {
    localStorage.setItem(INSTALL_PROMOTION_DISMISSED_KEY, "1");
  } catch {
    // The promotion remains harmless if browser privacy settings block storage.
  }
}

export function usePwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setDismissed(true);
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
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "dismissed") {
      recordDismissal();
      setDismissed(true);
    }
  };

  const dismiss = () => {
    recordDismissal();
    setDismissed(true);
  };

  return {
    available: !installed && !dismissed && Boolean(promptEvent || iosInstructionsAvailable),
    instructionsOpen,
    setInstructionsOpen,
    install,
    dismiss,
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

/** A compact first-entry promotion; the native browser prompt remains click-driven. */
export function PwaInstallPromotion() {
  const controller = usePwaInstallPrompt();

  if (!controller.available) return null;

  return (
    <Dialog.Root
      open={controller.instructionsOpen}
      onOpenChange={controller.setInstructionsOpen}
    >
      <Callout.Root
        dir="rtl"
        color="violet"
        className="pwa-install-promotion fixed z-[60] w-[min(25rem,calc(100dvw-2rem))]"
      >
        <Callout.Text>
          افزودن تنطیم به صفحهٔ اصلی، دسترسی سریع‌تر و استفادهٔ آفلاین مطمئن‌تر را فراهم می‌کند.
        </Callout.Text>
        <Flex mt="3" gap="2" justify="end" wrap="wrap">
          <Button onClick={() => { void controller.install(); }}>
            <DownloadIcon />
            نصب برنامه
          </Button>
          <Button variant="soft" color="gray" onClick={controller.dismiss}>
            بعداً
          </Button>
        </Flex>
        <IconButton
          aria-label="بستن پیشنهاد نصب"
          variant="ghost"
          color="gray"
          className="absolute left-1 top-1"
          onClick={controller.dismiss}
        >
          <Cross1Icon />
        </IconButton>
      </Callout.Root>
      <Dialog.Content maxWidth="420px" dir="rtl">
        <Dialog.Title>افزودن به صفحهٔ اصلی</Dialog.Title>
        <Dialog.Description>
          در Safari دکمهٔ اشتراک‌گذاری را بزنید و سپس «Add to Home Screen» را انتخاب کنید.
        </Dialog.Description>
        <Flex justify="end" mt="5">
          <Dialog.Close><Button>متوجه شدم</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
