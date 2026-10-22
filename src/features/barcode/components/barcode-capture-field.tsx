import { CameraIcon, Cross2Icon, InfoCircledIcon } from "@radix-ui/react-icons";
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
  tone?: "create" | "edit";
};

export function BarcodeCaptureField({ value, onValueChange, disabled = false, placeholder = "اسکن یا ورود دستی", tone = "create" }: Props) {
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
        <Dialog.Content maxWidth="560px" dir="rtl" className="barcode-scanner-dialog" data-tone={tone}>
          <Flex align="center" justify="between" gap="3" className="barcode-scanner-header">
            <Dialog.Title className="barcode-scanner-title">اسکن بارکد با دوربین</Dialog.Title>
            <Dialog.Close>
              <Button type="button" color="gray" variant="soft" className="barcode-scanner-close-icon" aria-label="بستن اسکنر">
                <Cross2Icon width="22" height="22" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </Flex>
          <Dialog.Description color="gray" className="barcode-scanner-description">بارکد را روبه‌روی دوربین نگه دارید؛ پس از تشخیص، کد به‌صورت خودکار در فرم قرار می‌گیرد.</Dialog.Description>
          <Box className="barcode-scanner-viewport">
            <video ref={videoRef} muted playsInline className="barcode-scanner-video" />
            <div className="barcode-scanner-shade" aria-hidden="true" />
            <div className="barcode-scanner-frame" aria-hidden="true">
              <span className="barcode-scanner-corner barcode-scanner-corner--top-start" />
              <span className="barcode-scanner-corner barcode-scanner-corner--top-end" />
              <span className="barcode-scanner-corner barcode-scanner-corner--bottom-start" />
              <span className="barcode-scanner-corner barcode-scanner-corner--bottom-end" />
              <span className="barcode-scanner-focus" />
              <span className="barcode-scanner-line" />
            </div>
            {!cameraActive ? (
              <Flex position="absolute" inset="0" align="center" justify="center" className="barcode-scanner-start-layer">
                <Button type="button" variant="soft" loading={starting} onClick={() => void startCamera()} leftIcon={<CameraIcon />} className="barcode-scanner-start-button">
                  فعال‌کردن دوربین
                </Button>
              </Flex>
            ) : null}
          </Box>
          {cameraError ? <Callout.Root color="red" role="alert" mt="3"><Callout.Text>{cameraError}</Callout.Text></Callout.Root> : null}
          <Flex align="center" gap="3" className="barcode-scanner-tip">
            <span className="barcode-scanner-tip-icon" aria-hidden="true"><InfoCircledIcon width="21" height="21" /></span>
            <Text size="2" color="gray">اسکنرهای فروشگاهی نیز با قرار دادن نشانگر داخل فیلد بارکد قابل استفاده‌اند.</Text>
          </Flex>
          <Dialog.Close><Button type="button" color="gray" variant="soft" className="barcode-scanner-close-button">بستن</Button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
