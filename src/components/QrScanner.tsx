// QR Scanner using html5-qrcode loaded from CDN for Vite compatibility
import { useEffect, useRef } from "react";

function loadHtml5QrcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.10/minified/html5-qrcode.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export function QrScanner({ onResult, onClose }: { onResult: (upiId: string) => void, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scanner: any;
    let stopped = false;
    let html5QrcodeId = "qr-reader-" + Math.random().toString(36).slice(2);
    if (ref.current) ref.current.id = html5QrcodeId;
    (async () => {
      await loadHtml5QrcodeScript();
      // @ts-ignore
      const Html5Qrcode = window.Html5Qrcode;
      scanner = new Html5Qrcode(html5QrcodeId);
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decoded: string) => {
          if (stopped) return;
          stopped = true;
          scanner.stop().then(() => {
            const match = decoded.match(/pa=([^&]+)/);
            if (match) onResult(decodeURIComponent(match[1]));
            else onResult(decoded);
          });
        },
        (err: any) => {}
      );
    })();
    return () => {
      stopped = true;
      scanner && scanner.stop();
    };
    // eslint-disable-next-line
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
      <div ref={ref} style={{ width: 300, height: 300 }} />
      <button onClick={onClose} className="mt-4 px-4 py-2 rounded bg-white text-black font-semibold">Cancel</button>
    </div>
  );
}
