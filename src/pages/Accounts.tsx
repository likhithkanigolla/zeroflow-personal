import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownToLine, Plus, Trash2, Wallet } from "lucide-react";
import { useAccounts, useTransactions } from "@/hooks/useZeroFlow";
import { addIncome } from "@/lib/finance";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { toast } from "sonner";

export default function Accounts() {
  const accounts = useAccounts();
  const txns = useTransactions(500);
  const [openIncome, setOpenIncome] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const totalCash = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="pb-32 px-5 pt-6 safe-top">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accounts</p>
        <h1 className="font-display text-3xl font-bold mt-1">Where your money lives</h1>
        <div className="mt-3 glass-card p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total cash</div>
            <div className="font-display text-3xl font-bold num">{formatMoney(totalCash)}</div>
          </div>
          <Wallet className="h-8 w-8 text-primary" />
        </div>
      </header>

      <div className="space-y-3">
        {accounts.map((a, i) => {
          const accTxns = txns.filter((t) => t.accountId === a.id).slice(0, 30).reverse();
          const sparkData = accTxns.map((t, idx) => ({ x: idx, y: t.amount }));
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 p-5 shadow-elev"
              style={{ background: `linear-gradient(135deg, hsl(var(--${a.color}) / 0.85), hsl(var(--${a.color}) / 0.45))` }}
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-white/70">{a.type}</p>
                  <h3 className="text-white font-display text-xl font-bold mt-0.5">{a.name}</h3>
                </div>
                <button onClick={() => db.accounts.delete(a.id!)} className="h-8 w-8 rounded-full bg-black/20 grid place-items-center text-white/80">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-3 flex items-end justify-between">
                <div>
                  <div className="text-white/70 text-[10px] uppercase tracking-widest">Balance</div>
                  <div className="text-white font-display text-3xl font-bold num">{formatMoney(a.balance)}</div>
                </div>
                <div className="w-32 h-12 -mb-1">
                  {sparkData.length > 1 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData}>
                        <defs>
                          <linearGradient id={`s-${a.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="white" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="white" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="y" stroke="white" strokeWidth={1.6} fill={`url(#s-${a.id})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="relative mt-4 flex gap-2">
                <button
                  onClick={() => { setOpenIncome(a.id!); setAmount(""); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold flex items-center justify-center gap-1 backdrop-blur-md"
                >
                  <ArrowDownToLine className="h-4 w-4" /> Add income
                </button>
              </div>
            </motion.div>
          );
        })}

        <AddAccountForm />
      </div>

      {openIncome !== null && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center px-5" onClick={() => setOpenIncome(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm glass rounded-3xl p-5">
            <h3 className="font-display text-xl font-bold">Add income</h3>
            <p className="text-sm text-muted-foreground">To {accounts.find((a) => a.id === openIncome)?.name}</p>
            <input
              autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="₹ 0"
              className="mt-3 w-full bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary num text-lg"
            />
            <button
              onClick={async () => {
                const amt = Number(amount) || 0;
                if (!amt || openIncome == null) return;
                await addIncome(openIncome, amt);
                toast.success(`+${formatMoney(amt)} added`);
                setOpenIncome(null);
              }}
              className="mt-3 w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            >Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddAccountForm() {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(""); const [b, setB] = useState(""); const [color, setColor] = useState("emerald");
  const COLORS = ["emerald","indigo","sky","violet","amber","rose"];
  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full glass-card p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition">
      <Plus className="h-4 w-4" /> Add another account
    </button>
  );
  return (
    <div className="glass-card p-4 space-y-3">
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Account name" className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none" />
      <input value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" placeholder="Balance ₹" className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none num" />
      <div className="flex gap-1.5">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-foreground" : ""}`} style={{ background: `hsl(var(--${c}))` }} />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-secondary text-sm">Cancel</button>
        <button
          onClick={async () => {
            if (!n.trim()) return;
            await db.accounts.add({ name: n.trim(), type: "bank", color, balance: Number(b) || 0, createdAt: Date.now(), updatedAt: Date.now() });
            setN(""); setB(""); setOpen(false);
          }}
          className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >Save</button>
      </div>
    </div>
  );
}
