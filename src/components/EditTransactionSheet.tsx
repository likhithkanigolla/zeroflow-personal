import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import type { Transaction } from "@/lib/db";
import { useAccounts, useCards, useCategories } from "@/hooks/useZeroFlow";
import { deleteTransaction, editTransaction } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "expense" | "income" | "transfer";

export function EditTransactionSheet({
  txn, onClose,
}: { txn: Transaction | null; onClose: () => void }) {
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();

  const [mode, setMode] = useState<Mode>("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [accountId, setAccountId] = useState<number | undefined>();
  const [cardId, setCardId] = useState<number | undefined>();
  const [toAccountId, setToAccountId] = useState<number | undefined>();
  const [payKind, setPayKind] = useState<"account" | "card">("account");

  useEffect(() => {
    if (!txn) return;
    const t = txn;
    if (t.type === "expense" || t.type === "income" || t.type === "transfer") setMode(t.type);
    else setMode("expense");
    setAmount(String(Math.abs(t.amount)));
    setMerchant(t.merchant ?? "");
    setNotes(t.notes ?? "");
    setCategoryId(t.categoryId);
    setAccountId(t.accountId);
    setCardId(t.cardId);
    setToAccountId(t.toAccountId);
    setPayKind(t.cardId ? "card" : "account");
  }, [txn]);

  if (!txn) return <AnimatePresence />;

  const amt = Number(amount.replace(/[^0-9.]/g, "")) || 0;

  const save = async () => {
    try {
      await editTransaction(txn.id!, {
        type: mode,
        amount: amt,
        merchant,
        notes,
        categoryId: mode === "expense" ? (categoryId ?? null) : null,
        accountId: payKind === "account" || mode === "income" || mode === "transfer" ? (accountId ?? null) : null,
        cardId: payKind === "card" && mode === "expense" ? (cardId ?? null) : null,
        toAccountId: mode === "transfer" ? (toAccountId ?? null) : null,
      });
      toast.success("Transaction updated");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    }
  };

  const remove = async () => {
    if (!confirm("Delete this transaction? Balances will be restored.")) return;
    await deleteTransaction(txn.id!);
    toast.success("Deleted");
    onClose();
  };

  return (
    <AnimatePresence>
      {txn && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[94vh] overflow-y-auto rounded-t-3xl glass border-t border-white/10 safe-bottom"
          >
            <div className="mx-auto max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Edit</p>
                  <h3 className="font-display text-xl font-bold">Transaction</h3>
                </div>
                <button onClick={onClose} className="h-9 w-9 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-secondary">
                {(["expense","income","transfer"] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={cn("py-2 rounded-xl text-sm font-semibold capitalize transition",
                      mode === m ? "bg-background text-foreground shadow" : "text-muted-foreground")}>
                    {m}
                  </button>
                ))}
              </div>

              <div className="text-center py-1">
                <div className="text-xs text-muted-foreground">Amount</div>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-2xl font-light text-muted-foreground">₹</span>
                  <input
                    inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent outline-none text-4xl font-display font-bold num text-center w-40"
                  />
                </div>
              </div>

              {mode === "expense" && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Category</div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {categories.map(c => (
                        <button key={c.id} onClick={() => setCategoryId(c.id)}
                          className={cn("shrink-0 px-3 py-2 rounded-2xl text-sm border transition",
                            categoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-transparent text-foreground/80")}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Paid via</div>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-secondary mb-2">
                      <button onClick={() => setPayKind("account")} className={cn("py-2 rounded-xl text-xs font-semibold", payKind === "account" ? "bg-background" : "text-muted-foreground")}>Account</button>
                      <button onClick={() => setPayKind("card")} className={cn("py-2 rounded-xl text-xs font-semibold", payKind === "card" ? "bg-background" : "text-muted-foreground")}>Credit card</button>
                    </div>
                    {payKind === "account" ? (
                      <select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}
                        className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {formatMoney(a.balance, "₹", true)}</option>)}
                      </select>
                    ) : (
                      <select value={cardId ?? ""} onChange={(e) => setCardId(Number(e.target.value))}
                        className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
                        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Merchant</div>
                    <input value={merchant} onChange={(e) => setMerchant(e.target.value)}
                      className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none" />
                  </div>
                </>
              )}

              {mode === "income" && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Deposit to</div>
                  <select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}
                    className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {mode === "transfer" && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">From → To</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}
                      className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select value={toAccountId ?? ""} onChange={(e) => setToAccountId(Number(e.target.value))}
                      className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none">
                      {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={remove} className="px-4 py-3 rounded-2xl bg-destructive/15 text-destructive font-semibold flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
                <button onClick={save} className="flex-1 py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
