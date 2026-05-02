import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, Check, Clock, X } from "lucide-react";
import { useAccounts, useCategories, useReimbursements } from "@/hooks/useZeroFlow";
import { settleReimbursement, type SettleAction } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "pending" | "settled";

export default function Reimbursements() {
  const reimb = useReimbursements();
  const accounts = useAccounts();
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>("pending");
  const [settling, setSettling] = useState<number | null>(null);

  const filtered = useMemo(
    () => reimb.filter(r => (tab === "pending" ? r.status !== "settled" : r.status === "settled")),
    [reimb, tab]
  );
  const totalPending = reimb.filter(r => r.status !== "settled").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="pb-32 px-5 pt-6 safe-top">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reimbursements</p>
        <h1 className="font-display text-3xl font-bold mt-1">Money owed to you</h1>
        <div className="mt-3 glass-card p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending</div>
            <div className="font-display text-3xl font-bold num">{formatMoney(totalPending)}</div>
          </div>
          <Users className="h-9 w-9 text-accent" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-secondary mb-4">
        {(["pending","settled"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("py-2 rounded-xl text-sm font-semibold capitalize transition",
              tab === t ? "bg-background text-foreground shadow" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="glass-card p-6 text-center text-sm text-muted-foreground">
            {tab === "pending" ? "Nothing pending. Use Split when adding an expense." : "No settled reimbursements yet."}
          </div>
        )}
        {filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="glass-card p-4 flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-xl grid place-items-center",
              r.status === "settled" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
              {r.status === "settled" ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{r.source}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {r.categoryId && categories.find(c => c.id === r.categoryId) && ` · ${categories.find(c => c.id === r.categoryId)!.name}`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold num text-sm">{formatMoney(r.amount)}</div>
              {r.status !== "settled" && (
                <button onClick={() => setSettling(r.id!)}
                  className="mt-1 text-[11px] px-2 py-1 rounded-full bg-primary/15 text-primary font-semibold">
                  Mark received
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {settling !== null && (
        <SettleModal
          reimb={reimb.find(r => r.id === settling)!}
          accounts={accounts}
          categories={categories}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}

function SettleModal({ reimb, accounts, categories, onClose }: any) {
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id);
  const [mode, setMode] = useState<"restore" | "balance" | "manual">(reimb.categoryId ? "restore" : "balance");
  const [manualCat, setManualCat] = useState<number | undefined>(categories[0]?.id);

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center px-5" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-sm glass rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Mark received</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatMoney(reimb.amount)} received from <strong>{reimb.source}</strong>
        </p>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Money lands in</div>
          <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}
            className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {reimb.categoryId && (
            <Choice on={mode === "restore"} onClick={() => setMode("restore")}
              title={`Restore "${categories.find((c: any) => c.id === reimb.categoryId)?.name ?? "category"}"`}
              sub="Reduces that bucket's spent by this amount" />
          )}
          <Choice on={mode === "balance"} onClick={() => setMode("balance")}
            title="Just add to balance" sub="No category restoration" />
          <Choice on={mode === "manual"} onClick={() => setMode("manual")}
            title="Allocate to another category" sub="Pick where to credit it">
            {mode === "manual" && (
              <select value={manualCat ?? ""} onChange={(e) => setManualCat(Number(e.target.value))}
                className="mt-2 w-full bg-background rounded-xl px-3 py-2 outline-none text-sm">
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Choice>
        </div>

        <button
          onClick={async () => {
            const action: SettleAction =
              mode === "restore" ? { kind: "restoreCategory", toAccountId: accountId } :
              mode === "balance" ? { kind: "addToBalance", toAccountId: accountId } :
              { kind: "manual", toAccountId: accountId, categoryId: manualCat!, amount: reimb.amount };
            await settleReimbursement(reimb.id, action);
            toast.success("Settled");
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
        >Confirm</button>
      </motion.div>
    </div>
  );
}

function Choice({ on, onClick, title, sub, children }: { on: boolean; onClick: () => void; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("w-full text-left p-3 rounded-2xl border transition",
        on ? "border-primary bg-primary/10" : "border-white/5 bg-secondary")}>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
      {children}
    </button>
  );
}
