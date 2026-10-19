export interface PrintTransport {
  print(documentHtml: string): void;
}

export const browserPrintTransport: PrintTransport = {
  print(documentHtml) {
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = url;
    document.body.appendChild(frame);
    const cleanup = () => { URL.revokeObjectURL(url); frame.remove(); };
    frame.onload = () => {
      const target = frame.contentWindow;
      if (!target) return cleanup();
      target.addEventListener("afterprint", cleanup, { once: true });
      void target.document.fonts.ready.then(() => {
        target.focus();
        target.print();
      });
      window.setTimeout(cleanup, 60_000);
    };
  },
};

export function downloadPrintableLabels(documentHtml: string) {
  const url = URL.createObjectURL(new Blob([documentHtml], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `tanzim-labels-${new Date().toISOString().slice(0, 10)}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
