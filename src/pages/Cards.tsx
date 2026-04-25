import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Calendar, AlertTriangle, Trash2, Plus } from "lucide-react";
import { useAccounts, useCards, useTransactions } from "@/hooks/useZeroFlow";
import { db } from "@/lib/db";
import { payCard } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Cards() {
  const cards = useCards();
  const accounts = useAccounts();
  const txns = useTransactions(500);
  const [payOpen, setPayOpen] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0) || 1;
  const utilPct = Math.round((totalOutstanding / totalLimit) * 100);

  return (
    <div className="pb-32 px-5 pt-6 safe-top">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Credit cards</p>
        <h1 className="font-display text-3xl font-bold mt-1">Liabilities</h1>
        <div className="mt-3 glass-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total outstanding</div>
              <div className="font-display text-3xl font-bold num">{formatMoney(totalOutstanding)}</div>
              <div className="text-xs text-muted-foreground mt-1">of {formatMoney(totalLimit, "₹", true)} limit</div>
            </div>
            <div className={cn("h-14 w-14 rounded-2xl grid place-items-center font-display font-bold text-lg",
              utilPct > 70 ? "bg-destructive/15 text-destructive" : utilPct > 40 ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary")}>
              {utilPct}%
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {cards.map((c, i) => {
          const usedPct = c.limit ? Math.min(100, (c.outstanding / c.limit) * 100) : 0;
          const cardTxns = txns.filter((t) => t.cardId === c.id && t.type === "expense");
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 shadow-elev p-5 text-white"
              style={{ background: `linear-gradient(135deg, hsl(var(--${c.color})), hsl(var(--${c.color}) / 0.5))` }}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl pointer-events-none" />
              <div className="relative flex justify-between items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-white/70">Credit card</p>
                  <h3 className="font-display text-xl font-bold mt-0.5">{c.name}</h3>
                </div>
                <div className="flex items-center gap-1 text-xs bg-white/15 px-2 py-1 rounded-full">
                  <Calendar className="h-3 w-3" /> Due {c.dueDay}
                </div>
              </div>
              <div className="relative mt-5 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/70">Outstanding</div>
                  <div className="font-display text-2xl font-bold num">{formatMoney(c.outstanding)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-white/70">Limit</div>
                  <div className="num font-semibold">{formatMoney(c.limit, "₹", true)}</div>
                </div>
              </div>
              <div className="relative mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="relative mt-4 flex items-center justify-between text-xs text-white/80">
                <span>{cardTxns.length} transactions</span>
                <div className="flex gap-2">
                  <button onClick={() => db.creditCards.delete(c.id!)} className="h-8 w-8 rounded-full bg-black/20 grid place-items-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setPayOpen(c.id!); setAccountId(accounts[0]?.id ?? null); setAmount(String(c.outstanding)); }}
                    className="px-4 h-9 rounded-full bg-white text-black font-semibold text-sm"
                  >Pay bill</button>
                </div>
              </div>
            </motion.div>
          );
        })}
        <AddCardForm />
      </div>

      {totalOutstanding > totalLimit * 0.7 && (
        <div className="mt-5 glass-card p-4 border border-warning/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-warning">High utilization</div>
            <div className="text-xs text-muted-foreground mt-0.5">Try to keep usage below 30% to protect your credit score.</div>
          </div>
        </div>
      )}

      {payOpen !== null && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center px-5" onClick={() => setPayOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm glass rounded-3xl p-5">
            <h3 className="font-display text-xl font-bold">Pay card bill</h3>
            <p className="text-sm text-muted-foreground">From your bank account</p>
            <select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))} className="mt-3 w-full bg-secondary rounded-2xl px-4 py-3 outline-none">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatMoney(a.balance)}</option>)}
            </select>
            <input
              value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
              className="mt-3 w-full bg-secondary rounded-2xl px-4 py-3 outline-none num text-lg"
            />
            <button
              onClick={async () => {
                const amt = Number(amount); if (!amt || !payOpen || !accountId) return;
                await payCard(payOpen, accountId, amt);
                toast.success("Card bill paid", { description: formatMoney(amt) });
                setPayOpen(null);
              }}
              className="mt-3 w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            >Confirm payment</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCardForm() {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(""); const [limit, setLimit] = useState(""); const [color, setColor] = useState("indigo");
  const COLORS = ["emerald","indigo","sky","violet","amber","rose"];
  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full glass-card p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
      <Plus className="h-4 w-4" /> Add credit card
    </button>
  );
  return (
    <div className="glass-card p-4 space-y-3">
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Card name" className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none" />
      <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="Limit ₹" className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none num" />
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
            await db.creditCards.add({ name: n.trim(), bank: n.trim(), color, limit: Number(limit) || 100000, outstanding: 0, dueDay: 5, statementDay: 25 });
            setN(""); setLimit(""); setOpen(false);
          }}
          className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >Save</button>
      </div>
    </div>
  );
}
