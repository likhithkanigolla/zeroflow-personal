import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("zf-install-dismissed")) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setShow(false);
  };
  const close = () => { setShow(false); sessionStorage.setItem("zf-install-dismissed", "1"); };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed bottom-24 inset-x-3 z-50 mx-auto max-w-md glass rounded-2xl p-3 flex items-center gap-3 shadow-elev"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center text-primary-foreground">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Install ZeroFlow</div>
            <div className="text-xs text-muted-foreground truncate">Use it like a real app, even offline</div>
          </div>
          <button onClick={install} className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">Install</button>
          <button onClick={close} className="h-8 w-8 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
