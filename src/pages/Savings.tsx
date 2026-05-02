import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Target, Trash2, ArrowDown, ArrowUp, X } from "lucide-react";
import { useAccounts, useSavingsGoals } from "@/hooks/useZeroFlow";
import { db } from "@/lib/db";
import { allocateToGoal, withdrawFromGoal } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = ["emerald","indigo","sky","violet","amber","rose"] as const;

export default function Savings() {
  const goals = useSavingsGoals();
  const accounts = useAccounts();
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<{ goalId: number; dir: "in" | "out" } | null>(null);

  const total = goals.reduce((s,g) => s + g.allocatedAmount, 0);
  const target = goals.reduce((s,g) => s + g.targetAmount, 0);

  return (
    <div className="pb-32 px-5 pt-6 safe-top">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Savings</p>
        <h1 className="font-display text-3xl font-bold mt-1">Goals worth chasing</h1>
        <div className="mt-3 glass-card p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total saved</div>
            <div className="font-display text-3xl font-bold num">{formatMoney(total)}</div>
            <div className="text-xs text-muted-foreground mt-1">of {formatMoney(target, "₹", true)} goal</div>
          </div>
          <Target className="h-9 w-9 text-primary" />
        </div>
      </header>

      <div className="space-y-3">
        {goals.map((g, i) => {
          const pct = g.targetAmount ? Math.min(100, (g.allocatedAmount / g.targetAmount) * 100) : 0;
          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-3xl p-5 border border-white/10 shadow-elev"
              style={{ background: `linear-gradient(135deg, hsl(var(--${g.color}) / 0.85), hsl(var(--${g.color}) / 0.4))` }}
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-white/70">Goal</p>
                  <h3 className="text-white font-display text-xl font-bold mt-0.5">{g.name}</h3>
                </div>
                <button onClick={async () => { if (confirm("Delete this goal? Money will NOT be returned automatically — withdraw it first.")) await db.savingsGoals.delete(g.id!); }}
                  className="h-8 w-8 rounded-full bg-black/20 grid place-items-center text-white/80">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-3 flex items-end justify-between">
                <div>
                  <div className="text-white/70 text-[10px] uppercase tracking-widest">Saved</div>
                  <div className="text-white font-display text-2xl font-bold num">{formatMoney(g.allocatedAmount)}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/70 text-[10px] uppercase tracking-widest">Target</div>
                  <div className="text-white num font-semibold">{formatMoney(g.targetAmount, "₹", true)}</div>
                </div>
              </div>
              <div className="relative mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
                  className="h-full bg-white rounded-full" />
              </div>
              <div className="relative mt-2 text-white/80 text-xs num">{Math.round(pct)}% there</div>
              <div className="relative mt-3 flex gap-2">
                <button onClick={() => setMoving({ goalId: g.id!, dir: "in" })}
                  className="flex-1 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold flex items-center justify-center gap-1 backdrop-blur-md">
                  <ArrowDown className="h-4 w-4" /> Allocate
                </button>
                <button onClick={() => setMoving({ goalId: g.id!, dir: "out" })}
                  className="flex-1 py-2.5 rounded-xl bg-black/20 text-white text-sm font-semibold flex items-center justify-center gap-1">
                  <ArrowUp className="h-4 w-4" /> Withdraw
                </button>
              </div>
            </motion.div>
          );
        })}

        <button onClick={() => setCreating(true)}
          className="w-full glass-card p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" /> New savings goal
        </button>

        {goals.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-2">
            No goals yet. Create one above and start moving money out of your spendable pool.
          </p>
        )}
      </div>

      {creating && <CreateGoalModal onClose={() => setCreating(false)} />}
      {moving && <MoveModal data={moving} accounts={accounts} onClose={() => setMoving(null)} />}
    </div>
  );
}

function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [color, setColor] = useState<typeof COLORS[number]>("indigo");
  return (
    <Modal title="New goal" onClose={onClose}>
      <div className="space-y-3">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trip to Japan"
          className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none" />
        <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
          placeholder="Target amount ₹"
          className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none num text-lg" />
        <div className="flex gap-2">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={cn("h-9 w-9 rounded-full border-2", color === c ? "border-foreground scale-110" : "border-transparent")}
              style={{ background: `hsl(var(--${c}))` }} />
          ))}
        </div>
        <button
          onClick={async () => {
            if (!name.trim() || !Number(target)) { toast.error("Name & target required"); return; }
            await db.savingsGoals.add({
              name: name.trim(), targetAmount: Number(target), allocatedAmount: 0,
              color, createdAt: Date.now(),
            });
            toast.success("Goal created");
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
        >Create goal</button>
      </div>
    </Modal>
  );
}

function MoveModal({ data, accounts, onClose }: { data: { goalId: number; dir: "in" | "out" }; accounts: any[]; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);
  const isIn = data.dir === "in";
  return (
    <Modal title={isIn ? "Allocate to goal" : "Withdraw from goal"} onClose={onClose}>
      <div className="space-y-3">
        <select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}
          className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
          {accounts.map(a => <option key={a.id} value={a.id}>{isIn ? "From" : "To"}: {a.name} · {formatMoney(a.balance, "₹", true)}</option>)}
        </select>
        <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric" placeholder="₹ 0"
          className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none num text-lg" />
        <button
          onClick={async () => {
            const amt = Number(amount);
            if (!amt || !accountId) return;
            if (isIn) await allocateToGoal(data.goalId, amt, accountId);
            else await withdrawFromGoal(data.goalId, amt, accountId);
            toast.success(isIn ? `+${formatMoney(amt)} saved` : `${formatMoney(amt)} withdrawn`);
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
        >Confirm</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center px-5" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-sm glass rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
