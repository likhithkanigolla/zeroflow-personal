// This is a React component for scanning QR codes using the browser camera.
// It uses the 'html5-qrcode' library for simplicity and wide support.
// Usage: <QrScanner onResult={upiId => ...} onClose={() => ...} />
import { useEffect, useRef } from "react";

export function QrScanner({ onResult, onClose }: { onResult: (upiId: string) => void, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scanner: any;
    let stopped = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      scanner = new Html5Qrcode(ref.current!.id);
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decoded: string) => {
          if (stopped) return;
          stopped = true;
          scanner.stop().then(() => {
            // UPI QR codes are typically in the format: upi://pay?pa=...&...
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
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
      <div id="qr-reader" ref={ref} style={{ width: 300, height: 300 }} />
      <button onClick={onClose} className="mt-4 px-4 py-2 rounded bg-white text-black font-semibold">Cancel</button>
    </div>
  );
}
