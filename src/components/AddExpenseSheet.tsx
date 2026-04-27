import { useEffect, useMemo, useState } from "react";
import { QrScanner } from "./QrScanner";
import { makeUpiUrl } from "@/lib/upi";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, CreditCard as CardIcon } from "lucide-react";
import { useAccounts, useCards, useCategories } from "@/hooks/useZeroFlow";
import { addExpense } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AddExpenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [showQr, setShowQr] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiConfirm, setUpiConfirm] = useState(false);
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [pay, setPay] = useState<{ kind: "account" | "card"; id: number } | undefined>();
  const [merchant, setMerchant] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(""); setMerchant("");
      setCategoryId(categories[0]?.id);
      setPay(accounts[0] ? { kind: "account", id: accounts[0].id! } : cards[0] ? { kind: "card", id: cards[0].id! } : undefined);
      setUpiId("");
      setShowQr(false);
      setUpiConfirm(false);
    }
  }, [open, categories, accounts, cards]);

  const amt = useMemo(() => Number(amount.replace(/[^0-9.]/g, "")) || 0, [amount]);

  const submit = async () => {
    if (!amt || !categoryId || !pay) return;
    await addExpense({ amount: amt, categoryId, pay, merchant });
    toast.success("Expense added", { description: `${formatMoney(amt)} • ${categories.find(c => c.id === categoryId)?.name}` });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {showQr && (
            <QrScanner
              onResult={id => { setUpiId(id); setShowQr(false); }}
              onClose={() => setShowQr(false)}
            />
          )}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl glass border-t border-white/10 safe-bottom"
          >
            <div className="mx-auto max-w-md p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Quick add</p>
                  <h3 className="font-display text-xl font-bold">New expense</h3>
                </div>
                <button onClick={onClose} className="h-9 w-9 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
              </div>

              <div className="text-center py-4">
                <div className="text-xs text-muted-foreground">Amount</div>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-3xl font-light text-muted-foreground">₹</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent outline-none text-5xl font-display font-bold num text-center w-44 placeholder:text-muted-foreground/30"
                  />
                </div>
                <div className="mt-4 flex flex-col gap-2 items-center">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold"
                    onClick={() => setShowQr(true)}
                  >
                    {upiId ? `UPI: ${upiId}` : "Scan UPI QR"}
                  </button>
                  {upiId && amt > 0 && (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold"
                      onClick={() => {
                        const url = makeUpiUrl({ pa: upiId, amount: amt, note: merchant });
                        window.location.href = url;
                        setTimeout(() => setUpiConfirm(true), 1000);
                      }}
                    >
                      Pay via UPI
                    </button>
                  )}
                  {upiConfirm && (
                    <div className="mt-2 flex flex-col items-center gap-2">
                      <div className="text-xs text-muted-foreground">Did you complete the payment?</div>
                      <button
                        className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold"
                        onClick={submit}
                      >Mark as paid & add expense</button>
                      <button
                        className="px-4 py-2 rounded-xl bg-secondary text-foreground font-semibold"
                        onClick={() => setUpiConfirm(false)}
                      >Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Category</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={cn(
                        "shrink-0 px-3 py-2 rounded-2xl text-sm border transition-colors",
                        categoryId === c.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary border-transparent text-foreground/80"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Paid via</div>
                <div className="grid grid-cols-2 gap-2">
                  {accounts.map((a) => (
                    <button
                      key={`a-${a.id}`}
                      onClick={() => setPay({ kind: "account", id: a.id! })}
                      className={cn(
                        "p-3 rounded-2xl text-left border flex items-center gap-2 transition",
                        pay?.kind === "account" && pay.id === a.id ? "border-primary bg-primary/10" : "border-white/5 bg-secondary"
                      )}
                    >
                      <Wallet className="h-4 w-4 text-primary" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        <div className="text-[11px] text-muted-foreground num">{formatMoney(a.balance, "₹", true)}</div>
                      </div>
                    </button>
                  ))}
                  {cards.map((c) => (
                    <button
                      key={`c-${c.id}`}
                      onClick={() => setPay({ kind: "card", id: c.id! })}
                      className={cn(
                        "p-3 rounded-2xl text-left border flex items-center gap-2 transition",
                        pay?.kind === "card" && pay.id === c.id ? "border-accent bg-accent/10" : "border-white/5 bg-secondary"
                      )}
                    >
                      <CardIcon className="h-4 w-4 text-accent" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground num">Outstanding {formatMoney(c.outstanding, "₹", true)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Merchant (optional)</div>
                <input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Blue Tokai"
                  className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={submit}
                disabled={!amt || !categoryId || !pay}
                className="w-full py-4 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-40 disabled:shadow-none"
              >
                Add {amt ? formatMoney(amt) : "expense"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
