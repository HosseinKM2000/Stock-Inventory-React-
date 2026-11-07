type NativeBarcode = { rawValue: string; format: string };
type NativeBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<NativeBarcode[]>;
};
type NativeBarcodeDetectorConstructor = {
  new(options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
};

const FORMATS = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e"];

export type CameraSession = { stop(): void; engine: "native" | "zxing" };

export async function startCameraScanner(video: HTMLVideoElement, onValue: (value: string) => void, onEmpty: () => void): Promise<CameraSession> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("دوربین در این مرورگر در دسترس نیست");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.srcObject = stream;
  await video.play();
  let stopped = false;
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
  const NativeDetector = (globalThis as typeof globalThis & { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
  if (NativeDetector) {
    const supported: string[] = await NativeDetector.getSupportedFormats().catch((): string[] => []);
    const formats = FORMATS.filter((format) => supported.includes(format));
    if (formats.length) {
      const detector = new NativeDetector({ formats });
      let timer = 0;
      const detect = async () => {
        if (stopped || document.hidden) return;
        try {
          const values = await detector.detect(video);
          if (values[0]?.rawValue) onValue(values[0].rawValue); else onEmpty();
        } catch {
          onEmpty();
        }
        if (!stopped) timer = window.setTimeout(() => void detect(), 250);
      };
      void detect();
      return { engine: "native", stop: () => { stopped = true; window.clearTimeout(timer); stopTracks(); video.srcObject = null; } };
    }
  }

  const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader();
  reader.possibleFormats = [BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];
  const controls = await reader.decodeFromStream(stream, video, (result) => {
    if (result) onValue(result.getText()); else onEmpty();
  });
  return { engine: "zxing", stop: () => { stopped = true; controls.stop(); stopTracks(); video.srcObject = null; } };
}
