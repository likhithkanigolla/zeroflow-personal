import { useRef } from "react";
import { Moon, Sun, Download, Upload, Trash2, Bell, RotateCcw, Sparkles } from "lucide-react";
import { db, exportBackup, importBackup, resetAll } from "@/lib/db";
import { useSettings } from "@/hooks/useZeroFlow";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  const toggleTheme = async () => {
    if (!settings) return;
    const next = settings.theme === "dark" ? "light" : "dark";
    await db.settings.update(settings.id!, { theme: next });
    document.documentElement.classList.toggle("light", next === "light");
  };

  const onExport = async () => {
    const json = await exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zeroflow-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Backup exported");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      await importBackup(text);
      toast.success("Backup restored");
    } catch (e) {
      toast.error("Invalid backup file");
    }
  };

  const onReset = async () => {
    if (!confirm("Erase ALL local data? This cannot be undone.")) return;
    await resetAll();
    toast.success("All data erased");
    nav("/onboarding", { replace: true });
  };

  return (
    <div className="pb-32 px-5 pt-6 safe-top">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
        <h1 className="font-display text-3xl font-bold mt-1">Yours, on your terms</h1>
      </header>

      <section className="glass-card p-5 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary grid place-items-center text-primary-foreground"><Sparkles className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold">{settings?.userName ?? "Friend"}</div>
            <div className="text-xs text-muted-foreground">ZeroFlow user · 100% local</div>
          </div>
        </div>
      </section>

      <Group label="Preferences">
        <Row icon={settings?.theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} title="Theme" sub={settings?.theme === "dark" ? "Dark" : "Light"}>
          <button onClick={toggleTheme} className="px-3 py-1.5 rounded-full bg-secondary text-sm">Toggle</button>
        </Row>
        <Row icon={<Bell className="h-4 w-4" />} title="Notifications" sub={settings?.notifications ? "On" : "Off"}>
          <Switch on={!!settings?.notifications} onClick={() => settings && db.settings.update(settings.id!, { notifications: !settings.notifications })} />
        </Row>
        <Row icon={<RotateCcw className="h-4 w-4" />} title="Monthly rollover" sub={settings?.rolloverEnabled ? "Carry leftover next month" : "Reset every month"}>
          <Switch on={!!settings?.rolloverEnabled} onClick={() => settings && db.settings.update(settings.id!, { rolloverEnabled: !settings.rolloverEnabled })} />
        </Row>
      </Group>

      <Group label="Data">
        <Row icon={<Download className="h-4 w-4" />} title="Export backup" sub="Download JSON snapshot">
          <button onClick={onExport} className="px-3 py-1.5 rounded-full bg-secondary text-sm">Export</button>
        </Row>
        <Row icon={<Upload className="h-4 w-4" />} title="Import backup" sub="Replace current data">
          <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-full bg-secondary text-sm">Import</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </Row>
        <Row icon={<Trash2 className="h-4 w-4 text-destructive" />} title="Reset all data" sub="Erase everything from this device">
          <button onClick={onReset} className="px-3 py-1.5 rounded-full bg-destructive/15 text-destructive text-sm font-semibold">Erase</button>
        </Row>
      </Group>

      <p className="text-center text-xs text-muted-foreground mt-6">ZeroFlow · Every rupee, a purpose</p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">{label}</div>
      <div className="glass-card divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-secondary grid place-items-center text-foreground/80">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`h-6 w-11 rounded-full p-0.5 transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
      <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}
