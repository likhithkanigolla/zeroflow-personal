// QR Scanner using html5-qrcode (loaded from CDN for Vite compatibility)
import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

declare global {
  interface Window { Html5Qrcode?: any }
}

function loadHtml5QrcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.10/minified/html5-qrcode.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load QR library"));
    document.body.appendChild(script);
  });
}

interface ScanResult {
  upiId: string;
  payeeName?: string;
  amount?: number;
  note?: string;
  raw: string;
}

export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (r: ScanResult) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let scanner: any;
    let stopped = false;
    const id = "qr-reader-" + Math.random().toString(36).slice(2);
    if (ref.current) ref.current.id = id;

    (async () => {
      try {
        await loadHtml5QrcodeScript();
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera not supported on this browser");
          return;
        }
        const Html5Qrcode = window.Html5Qrcode;
        scanner = new Html5Qrcode(id);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            if (stopped) return;
            stopped = true;
            const out = parseUpi(decoded);
            scanner.stop().then(() => onResult(out)).catch(() => onResult(out));
          },
          () => {}
        );
        setReady(true);
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (/permission|denied/i.test(msg)) setError("Camera permission denied. Allow access in browser settings.");
        else setError(msg || "Couldn't start camera");
      }
    })();

    return () => {
      stopped = true;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      <div className="safe-top px-5 pt-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/60">Scan & Pay</p>
          <h3 className="text-white font-display text-lg font-bold">Point at UPI QR</h3>
        </div>
        <button onClick={onClose} className="h-10 w-10 rounded-full bg-white/10 grid place-items-center text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 grid place-items-center px-5">
        {error ? (
          <div className="max-w-xs text-center text-white/80 space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/20 grid place-items-center text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <p className="text-sm">{error}</p>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-sm">Close</button>
          </div>
        ) : (
          <div className="relative">
            <div ref={ref} style={{ width: 280, height: 280 }} className="rounded-3xl overflow-hidden bg-black/60" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 pointer-events-none rounded-3xl border-2 border-primary/70"
            >
              <span className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
              <span className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
              <span className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
              <span className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-primary rounded-br-2xl" />
            </motion.div>
            {!ready && (
              <div className="absolute inset-0 grid place-items-center text-white/70">
                <Camera className="h-8 w-8 animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-white/50 pb-8 px-8">
        Reads any UPI QR. We extract payee, amount and note when present.
      </p>
    </div>
  );
}

function parseUpi(decoded: string): ScanResult {
  try {
    const url = new URL(decoded);
    if (url.protocol === "upi:" || decoded.startsWith("upi://")) {
      const sp = new URLSearchParams(url.search || decoded.split("?")[1] || "");
      return {
        upiId: sp.get("pa") || decoded,
        payeeName: sp.get("pn") || undefined,
        amount: sp.get("am") ? Number(sp.get("am")) : undefined,
        note: sp.get("tn") || undefined,
        raw: decoded,
      };
    }
  } catch {}
  const m = decoded.match(/pa=([^&]+)/);
  return { upiId: m ? decodeURIComponent(m[1]) : decoded, raw: decoded };
}
