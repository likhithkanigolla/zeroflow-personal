import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, ArrowRightLeft, Pencil } from "lucide-react";
import { useCategories } from "@/hooks/useZeroFlow";
import { db } from "@/lib/db";
import { reallocate } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Budget() {
  const cats = useCategories();
  const [editing, setEditing] = useState<number | null>(null);
  const [val, setVal] = useState("");
  const [reallocFrom, setReallocFrom] = useState<number | null>(null);
  const [reallocTo, setReallocTo] = useState<number | null>(null);
  const [reallocAmt, setReallocAmt] = useState("");

  const totals = useMemo(() => ({
    allocated: cats.reduce((s, c) => s + c.allocated, 0),
    spent: cats.reduce((s, c) => s + c.spent, 0),
  }), [cats]);
  const left = totals.allocated - totals.spent;

  const adjust = async (id: number, delta: number) => {
    const c = cats.find((c) => c.id === id);
    if (!c) return;
    await db.categories.update(id, { allocated: Math.max(0, c.allocated + delta) });
  };

  return (
    <div className="pb-32 px-5 pt-6 safe-top">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Budget</p>
        <h1 className="font-display text-3xl font-bold mt-1">Allocate every rupee</h1>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat label="Allocated" value={formatMoney(totals.allocated, "₹", true)} />
        <Stat label="Spent" value={formatMoney(totals.spent, "₹", true)} />
        <Stat label="Left" value={formatMoney(left, "₹", true)} accent={left < 0 ? "danger" : "good"} />
      </div>

      <div className="space-y-3">
        {cats.map((c, i) => {
          const leftCat = c.allocated - c.spent;
          const pct = c.allocated ? Math.min(100, (c.spent / c.allocated) * 100) : 0;
          const ringPct = Math.min(100, pct);
          const over = leftCat < 0;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-4">
                <Ring pct={ringPct} color={over ? "destructive" : c.color} label={`${Math.round(pct)}%`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display font-bold">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground num">{formatMoney(c.spent)} of {formatMoney(c.allocated)}</div>
                    </div>
                    <button onClick={() => { setEditing(c.id!); setVal(String(c.allocated)); }} className="h-8 w-8 rounded-full bg-secondary grid place-items-center">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className={cn("font-semibold num", over ? "text-destructive" : "text-foreground")}>
                      {over ? `Over by ${formatMoney(-leftCat)}` : `${formatMoney(leftCat)} left`}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => adjust(c.id!, -500)} className="h-8 w-8 rounded-full bg-secondary grid place-items-center"><Minus className="h-3.5 w-3.5" /></button>
                      <button onClick={() => adjust(c.id!, +500)} className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: over ? "hsl(var(--destructive))" : `hsl(var(--${c.color}))` }} />
              </div>
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={() => { setReallocFrom(cats[0]?.id ?? null); setReallocTo(cats[1]?.id ?? null); setReallocAmt(""); }}
        className="mt-4 w-full glass-card p-4 flex items-center justify-center gap-2 text-sm font-semibold"
      >
        <ArrowRightLeft className="h-4 w-4 text-primary" /> Move money between categories
      </button>

      {editing !== null && (
        <Modal onClose={() => setEditing(null)} title={`Edit ${cats.find(c => c.id === editing)?.name}`}>
          <input
            autoFocus value={val} onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none num text-lg"
          />
          <button
            onClick={async () => { await db.categories.update(editing!, { allocated: Number(val) || 0 }); setEditing(null); toast.success("Updated"); }}
            className="mt-3 w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
          >Save</button>
        </Modal>
      )}

      {reallocFrom !== null && (
        <Modal onClose={() => setReallocFrom(null)} title="Move money">
          <div className="grid grid-cols-2 gap-2">
            <Select label="From" value={reallocFrom} onChange={setReallocFrom} options={cats.map(c => ({ id: c.id!, name: c.name }))} />
            <Select label="To" value={reallocTo} onChange={setReallocTo} options={cats.filter(c => c.id !== reallocFrom).map(c => ({ id: c.id!, name: c.name }))} />
          </div>
          <input
            value={reallocAmt} onChange={(e) => setReallocAmt(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Amount" className="mt-3 w-full bg-secondary rounded-2xl px-4 py-3 outline-none num"
          />
          <button
            onClick={async () => {
              if (!reallocFrom || !reallocTo || !reallocAmt) return;
              await reallocate(reallocFrom, reallocTo, Number(reallocAmt));
              toast.success("Reallocated");
              setReallocFrom(null);
            }}
            className="mt-3 w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
          >Move</button>
        </Modal>
      )}
    </div>
  );
}

function Ring({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 60 60" className="h-14 w-14 -rotate-90">
        <circle cx="30" cy="30" r={r} stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
        <motion.circle
          cx="30" cy="30" r={r} stroke={`hsl(var(--${color}))`} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[10px] font-bold num">{label}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "good" | "danger" }) {
  return (
    <div className="glass-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("font-display font-bold text-lg num mt-1", accent === "good" && "text-primary", accent === "danger" && "text-destructive")}>{value}</div>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center px-5" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-sm glass rounded-3xl p-5"
      >
        <h3 className="font-display text-xl font-bold mb-3">{title}</h3>
        {children}
      </motion.div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: number | null; onChange: (v: number) => void; options: { id: number; name: string }[] }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none"
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
