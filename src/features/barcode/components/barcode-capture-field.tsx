import { CameraIcon, Cross2Icon } from "@radix-ui/react-icons";
import { Box, Callout, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button";
import { sanitizeScannedValue } from "../domain/barcode";
import { startCameraScanner, type CameraSession } from "../input/camera-scanner";

type Props = {
  value: string;
  onValueChange(value: string): void;
  disabled?: boolean;
  placeholder?: string;
};

export function BarcodeCaptureField({ value, onValueChange, disabled = false, placeholder = "اسکن یا ورود دستی" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const cameraRequestRef = useRef(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStarting(false);
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleOpenChange = (open: boolean) => {
    if (!open) stopCamera();
    setCameraError(null);
    setCameraOpen(open);
  };

  const startCamera = async () => {
    if (!videoRef.current || sessionRef.current) return;
    const request = cameraRequestRef.current + 1;
    cameraRequestRef.current = request;
    setStarting(true);
    setCameraError(null);
    try {
      const session = await startCameraScanner(
        videoRef.current,
        (rawValue) => {
          const next = sanitizeScannedValue(rawValue);
          if (!next) return;
          onValueChange(next);
          stopCamera();
          setCameraOpen(false);
        },
        () => undefined,
      );
      if (cameraRequestRef.current !== request) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      setCameraActive(true);
    } catch (error) {
      stopCamera();
      setCameraError(error instanceof Error ? error.message : "دسترسی به دوربین ممکن نیست");
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <Flex gap="2" align="stretch" className="product-barcode-capture min-w-0">
        <TextField.Root
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          aria-label="کد بارکد"
          dir="ltr"
          disabled={disabled}
          className="product-barcode-code-input min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="soft"
          aria-label="اسکن بارکد با دوربین"
          title="اسکن با دوربین"
          disabled={disabled}
          className="product-barcode-camera-button"
          onClick={() => setCameraOpen(true)}
        >
          <CameraIcon width="19" height="19" />
        </Button>
      </Flex>

      <Dialog.Root open={cameraOpen} onOpenChange={handleOpenChange}>
        <Dialog.Content maxWidth="460px" dir="rtl">
          <Dialog.Title>اسکن بارکد با دوربین</Dialog.Title>
          <Dialog.Description color="gray">بارکد را روبه‌روی دوربین نگه دارید؛ پس از تشخیص، کد داخل فرم قرار می‌گیرد.</Dialog.Description>
          <Box mt="4" className="relative min-h-56 overflow-hidden rounded-3xl bg-[var(--gray-3)]">
            <video ref={videoRef} muted playsInline className="aspect-video h-full w-full object-cover" />
            {!cameraActive ? (
              <Flex position="absolute" inset="0" align="center" justify="center">
                <Button type="button" variant="soft" loading={starting} onClick={() => void startCamera()} leftIcon={<CameraIcon />}>
                  فعال‌کردن دوربین
                </Button>
              </Flex>
            ) : null}
          </Box>
          {cameraError ? <Callout.Root color="red" role="alert" mt="3"><Callout.Text>{cameraError}</Callout.Text></Callout.Root> : null}
          <Flex justify="between" align="center" gap="3" mt="4">
            <Text size="1" color="gray">اسکنرهای فروشگاهی نیز با قرار دادن نشانگر داخل فیلد بارکد قابل استفاده‌اند.</Text>
            <Dialog.Close><Button type="button" color="gray" variant="soft" leftIcon={<Cross2Icon />}>بستن</Button></Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
