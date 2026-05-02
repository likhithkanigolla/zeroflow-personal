// QR Scanner — production-grade, iPhone Safari compatible
// Uses Html5Qrcode (lower-level API) installed via npm, NOT the CDN wrapper.
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanResult {
  upiId: string;
  payeeName?: string;
  amount?: number;
  note?: string;
  raw: string;
}

type ScannerStatus =
  | "idle"           // before user taps "Start"
  | "checking"       // running preflight checks
  | "requesting"     // awaiting getUserMedia permission
  | "starting"       // scanner initialising
  | "active"         // camera live, scanning
  | "error";         // terminal error — show message + retry

// ─── Camera preflight ────────────────────────────────────────────────────────

async function cameraPreflight(): Promise<void> {
  // 1. Secure context required by all browsers
  if (!window.isSecureContext) {
    throw new Error(
      "Camera access requires HTTPS (or localhost). " +
      "Please open the app over a secure connection."
    );
  }

  // 2. mediaDevices API availability
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Your browser does not support camera access (getUserMedia). " +
      "Please use Safari 14+, Chrome 80+, or Firefox 68+."
    );
  }

  // 3. Check that at least one video input exists
  const devices = await navigator.mediaDevices.enumerateDevices();
  const hasCamera = devices.some((d) => d.kind === "videoinput");
  if (!hasCamera) {
    throw new Error(
      "No camera found on this device. " +
      "Make sure your camera is connected and not in use by another app."
    );
  }
}

// ─── UPI parser ──────────────────────────────────────────────────────────────

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
  } catch {
    // fall through to raw extraction
  }
  const m = decoded.match(/pa=([^&]+)/);
  return { upiId: m ? decodeURIComponent(m[1]) : decoded, raw: decoded };
}

// ─── Status label helper ─────────────────────────────────────────────────────

function statusLabel(status: ScannerStatus): string {
  switch (status) {
    case "checking":   return "Checking camera support…";
    case "requesting": return "Requesting camera permission…";
    case "starting":   return "Starting camera…";
    case "active":     return "Camera active — point at a UPI QR code";
    default:           return "";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const READER_ID = "qr-reader-container";

export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (r: ScanResult) => void;
  onClose: () => void;
}) {
  const [status, setStatus]     = useState<ScannerStatus>("idle");
  const [error, setError]       = useState<string | null>(null);
  const scannerRef              = useRef<Html5Qrcode | null>(null);
  const completedRef            = useRef(false);

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    const sc = scannerRef.current;
    if (!sc) return;
    try {
      const state = sc.getState();
      // getState() returns 2 when scanning, 3 when paused
      if (state === 2 || state === 3) {
        await sc.stop();
      }
      sc.clear();
    } catch {
      // ignore — already stopped or never started
    }
    scannerRef.current = null;
  }, []);

  // ── Main start flow ────────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    completedRef.current = false;
    setError(null);

    // ── Step 1: Preflight ────────────────────────────────────────────────────
    setStatus("checking");
    console.log("[QrScanner] navigator.mediaDevices:", navigator.mediaDevices);
    console.log("[QrScanner] getUserMedia:", navigator.mediaDevices?.getUserMedia);
    console.log("[QrScanner] isSecureContext:", window.isSecureContext);
    console.log("[QrScanner] protocol:", location.protocol);

    try {
      await cameraPreflight();
    } catch (e: unknown) {
      setError((e as Error).message);
      setStatus("error");
      return;
    }

    // ── Step 2: Explicit permission request ──────────────────────────────────
    // iOS Safari REQUIRES getUserMedia to be called from a user-gesture context.
    // startScanner is only called from a button click, so this is safe.
    setStatus("requesting");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      console.log("[QrScanner] Permission granted. Tracks:", stream.getTracks().map(t => t.label));
    } catch (e: unknown) {
      const msg = (e as Error).message || "";
      if (/denied|permission/i.test(msg)) {
        setError("Camera permission was denied.\n\nTo fix: go to Safari Settings → this site → Camera → Allow.");
      } else {
        setError("Could not access camera: " + msg);
      }
      setStatus("error");
      return;
    } finally {
      // Release the test stream — Html5Qrcode will open its own
      stream?.getTracks().forEach((t) => t.stop());
    }

    // Enumerate devices for diagnostics
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log("[QrScanner] Available devices:", devices.filter(d => d.kind === "videoinput").map(d => d.label || d.deviceId));
    } catch {/* ignore */}

    // ── Step 3: Initialise Html5Qrcode (NOT Html5QrcodeScanner) ─────────────
    setStatus("starting");
    await stopScanner(); // clean up any stale instance

    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },   // rear camera on mobile
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
          // Required for iOS Safari: video must play inline
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decodedText) => {
          if (completedRef.current) return;
          completedRef.current = true;
          const result = parseUpi(decodedText);
          stopScanner().finally(() => onResult(result));
        },
        (_errorMsg) => {
          // Per-frame decode errors are noisy — suppress them
        }
      );
      setStatus("active");
    } catch (e: unknown) {
      const msg = (e as Error).message || String(e);
      console.error("[QrScanner] start() failed:", msg);
      if (/permission|denied/i.test(msg)) {
        setError("Camera permission denied. Allow access in your browser/device settings.");
      } else if (/insecure|https/i.test(msg)) {
        setError("Camera requires HTTPS. Please open the app over a secure connection.");
      } else {
        setError("Failed to start camera scanner.\n\n" + msg);
      }
      setStatus("error");
    }
  }, [onResult, stopScanner]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const isLoading = status === "checking" || status === "requesting" || status === "starting";
  const isActive  = status === "active";
  const isIdle    = status === "idle";
  const isError   = status === "error";

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="safe-top px-5 pt-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/60">Scan &amp; Pay</p>
          <h3 className="text-white font-display text-lg font-bold">Point at UPI QR</h3>
        </div>
        <button
          onClick={() => { stopScanner(); onClose(); }}
          className="h-10 w-10 rounded-full bg-white/10 grid place-items-center text-white"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 grid place-items-center px-5">
        <AnimatePresence mode="wait">
          {/* ── Error state ── */}
          {isError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="max-w-xs text-center text-white/80 space-y-4"
            >
              <div className="mx-auto h-14 w-14 rounded-2xl bg-red-500/20 grid place-items-center text-red-400">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={startScanner}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Idle state — user must tap to start (required by iOS) ── */}
          {isIdle && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center space-y-5"
            >
              <div className="mx-auto h-20 w-20 rounded-3xl bg-primary/20 grid place-items-center text-primary">
                <Camera className="h-10 w-10" />
              </div>
              <div>
                <p className="text-white font-semibold text-base">Ready to scan</p>
                <p className="text-white/50 text-xs mt-1">Tap the button to open your camera</p>
              </div>
              <button
                onClick={startScanner}
                className="px-8 py-3 rounded-2xl bg-primary text-white font-bold text-sm tracking-wide"
              >
                Start Camera
              </button>
            </motion.div>
          )}

          {/* ── Loading / starting ── */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4"
            >
              {/* Camera viewfinder shell (always rendered so Html5Qrcode has a DOM target) */}
              <div className="relative mx-auto" style={{ width: 280, height: 280 }}>
                <div
                  id={READER_ID}
                  style={{ width: 280, height: 280 }}
                  className="rounded-3xl overflow-hidden bg-black/60"
                />
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="h-10 w-10 text-white/60 animate-spin" />
                </div>
              </div>
              <p className="text-white/60 text-xs">{statusLabel(status)}</p>
            </motion.div>
          )}

          {/* ── Active scanning ── */}
          {isActive && (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative"
            >
              {/* Html5Qrcode renders video into this div */}
              <div
                id={READER_ID}
                style={{ width: 280, height: 280 }}
                className="rounded-3xl overflow-hidden bg-black/60"
              />

              {/* Corner brackets overlay */}
              <div className="absolute inset-0 pointer-events-none rounded-3xl border-2 border-primary/70">
                <span className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                <span className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                <span className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                <span className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-primary rounded-br-2xl" />
              </div>

              {/* Animated scan line */}
              <motion.div
                className="absolute left-4 right-4 h-0.5 bg-primary/80 rounded-full pointer-events-none"
                initial={{ top: "10%" }}
                animate={{ top: "88%" }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer hint */}
      <p className="text-center text-xs text-white/40 pb-8 px-8">
        Reads any UPI QR — payee, amount &amp; note extracted automatically.
      </p>
    </div>
  );
}
