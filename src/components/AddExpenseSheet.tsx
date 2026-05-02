import { useEffect, useMemo, useState } from "react";
import { QrScanner } from "./QrScanner";
import { makeUpiUrl } from "@/lib/upi";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, CreditCard as CardIcon, ArrowRight, Users, ScanLine } from "lucide-react";
import { useAccounts, useCards, useCategories } from "@/hooks/useZeroFlow";
import { addExpense, addIncome, addTransfer } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "expense" | "income" | "transfer";

export function AddExpenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();

  const [mode, setMode] = useState<Mode>("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [pay, setPay] = useState<{ kind: "account" | "card"; id: number } | undefined>();
  const [toAccountId, setToAccountId] = useState<number | undefined>();
  const [incomeAccountId, setIncomeAccountId] = useState<number | undefined>();

  // Split
  const [isShared, setIsShared] = useState(false);
  const [participants, setParticipants] = useState(2);

  // UPI
  const [showQr, setShowQr] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiPayee, setUpiPayee] = useState("");

  useEffect(() => {
    if (open) {
      setMode("expense");
      setAmount(""); setMerchant(""); setNotes("");
      setCategoryId(categories[0]?.id);
      setPay(accounts[0] ? { kind: "account", id: accounts[0].id! } : cards[0] ? { kind: "card", id: cards[0].id! } : undefined);
      setIncomeAccountId(accounts[0]?.id);
      setToAccountId(accounts[1]?.id ?? accounts[0]?.id);
      setIsShared(false); setParticipants(2);
      setUpiId(""); setUpiPayee(""); setShowQr(false);
    }
  }, [open, categories, accounts, cards]);

  const amt = useMemo(() => Number(amount.replace(/[^0-9.]/g, "")) || 0, [amount]);
  const userShare = isShared && participants > 0 ? Math.round(amt / participants) : amt;
  const othersShare = Math.max(0, amt - userShare);

  const submit = async () => {
    try {
      if (mode === "expense") {
        if (!amt || !categoryId || !pay) return;
        await addExpense({
          amount: amt,
          categoryId,
          pay,
          merchant: merchant || upiPayee || undefined,
          notes,
          isShared,
          splitMeta: isShared ? { totalAmount: amt, participants, userShare, othersShare } : undefined,
        });
        toast.success("Expense added", {
          description: `${formatMoney(amt)}${isShared ? ` · your share ${formatMoney(userShare)}` : ""}`,
        });
      } else if (mode === "income") {
        if (!amt || !incomeAccountId) return;
        await addIncome(incomeAccountId, amt, notes);
        toast.success(`+${formatMoney(amt)} income`);
      } else if (mode === "transfer") {
        const from = pay?.kind === "account" ? pay.id : undefined;
        if (!amt || !from || !toAccountId) return;
        await addTransfer(from, toAccountId, amt, notes);
        toast.success("Transfer complete", {
          description: `${formatMoney(amt)} moved`,
        });
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    }
  };

  const fromAccountForTransfer = pay?.kind === "account" ? accounts.find(a => a.id === pay.id) : undefined;
  const toAcc = accounts.find(a => a.id === toAccountId);

  const canSubmit =
    mode === "expense" ? !!(amt && categoryId && pay) :
    mode === "income"  ? !!(amt && incomeAccountId) :
                         !!(amt && fromAccountForTransfer && toAccountId && toAccountId !== fromAccountForTransfer?.id);

  return (
    <AnimatePresence>
      {open && (
        <>
          {showQr && (
            <QrScanner
              onResult={(r) => {
                setUpiId(r.upiId);
                setUpiPayee(r.payeeName || "");
                if (r.amount) setAmount(String(r.amount));
                if (!merchant && r.payeeName) setMerchant(r.payeeName);
                if (!notes && r.note) setNotes(r.note);
                setShowQr(false);
              }}
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[94vh] overflow-y-auto rounded-t-3xl glass border-t border-white/10 safe-bottom"
          >
            <div className="mx-auto max-w-md p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Quick add</p>
                  <h3 className="font-display text-xl font-bold">
                    {mode === "expense" ? "New expense" : mode === "income" ? "Add income" : "Move money"}
                  </h3>
                </div>
                <button onClick={onClose} className="h-9 w-9 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
              </div>

              {/* Mode tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-secondary">
                {(["expense","income","transfer"] as Mode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "py-2 rounded-xl text-sm font-semibold capitalize transition",
                      mode === m ? "bg-background text-foreground shadow" : "text-muted-foreground"
                    )}
                  >{m}</button>
                ))}
              </div>

              {/* Amount */}
              <div className="text-center py-2">
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
                {mode === "expense" && isShared && amt > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Your share <span className="text-primary font-semibold num">{formatMoney(userShare)}</span> · Others owe <span className="text-foreground font-semibold num">{formatMoney(othersShare)}</span>
                  </div>
                )}
              </div>

              {/* TRANSFER UI */}
              {mode === "transfer" && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">From → To</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={pay?.kind === "account" ? pay.id : ""}
                      onChange={(e) => setPay({ kind: "account", id: Number(e.target.value) })}
                      className="flex-1 bg-secondary rounded-2xl px-3 py-3 outline-none"
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                    <select
                      value={toAccountId ?? ""}
                      onChange={(e) => setToAccountId(Number(e.target.value))}
                      className="flex-1 bg-secondary rounded-2xl px-3 py-3 outline-none"
                    >
                      {accounts.filter(a => a.id !== (pay?.kind === "account" ? pay.id : -1)).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  {fromAccountForTransfer && toAcc && (
                    <p className="mt-2 text-[11px] text-muted-foreground num text-center">
                      {fromAccountForTransfer.name} ({formatMoney(fromAccountForTransfer.balance, "₹", true)}) → {toAcc.name} ({formatMoney(toAcc.balance, "₹", true)})
                    </p>
                  )}
                </div>
              )}

              {/* INCOME UI */}
              {mode === "income" && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Deposit to</div>
                  <select
                    value={incomeAccountId ?? ""}
                    onChange={(e) => setIncomeAccountId(Number(e.target.value))}
                    className="w-full bg-secondary rounded-2xl px-3 py-3 outline-none"
                  >
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {formatMoney(a.balance, "₹", true)}</option>)}
                  </select>
                </div>
              )}

              {/* EXPENSE UI */}
              {mode === "expense" && (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowQr(true)}
                      className="px-3 py-2 rounded-xl bg-primary/15 text-primary font-semibold text-sm flex items-center gap-1.5"
                    >
                      <ScanLine className="h-4 w-4" />
                      {upiId ? `UPI: ${upiId.slice(0, 18)}` : "Scan UPI QR"}
                    </button>
                    {upiId && amt > 0 && (
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                        onClick={() => {
                          window.location.href = makeUpiUrl({ pa: upiId, pn: upiPayee, amount: amt, note: merchant });
                        }}
                      >Pay via UPI</button>
                    )}
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

                  {/* Split toggle */}
                  <div className="glass-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-accent" />
                        <div>
                          <div className="text-sm font-semibold">Split with friends</div>
                          <div className="text-[11px] text-muted-foreground">Tracks pending reimbursements</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsShared(s => !s)}
                        className={cn("h-6 w-11 rounded-full p-0.5 transition", isShared ? "bg-primary" : "bg-muted")}
                      >
                        <div className={cn("h-5 w-5 rounded-full bg-white transition-transform", isShared && "translate-x-5")} />
                      </button>
                    </div>
                    {isShared && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">People (incl. you)</span>
                        <button onClick={() => setParticipants(Math.max(2, participants - 1))} className="h-7 w-7 rounded-full bg-secondary">−</button>
                        <span className="num font-semibold w-6 text-center">{participants}</span>
                        <button onClick={() => setParticipants(participants + 1)} className="h-7 w-7 rounded-full bg-secondary">+</button>
                      </div>
                    )}
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
                </>
              )}

              {(mode === "income" || mode === "transfer") && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Note (optional)</div>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={mode === "income" ? "Source · Salary, gift…" : "Reason"}
                    className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <button
                onClick={submit}
                disabled={!canSubmit}
                className="w-full py-4 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-40 disabled:shadow-none"
              >
                {mode === "expense" ? `Add ${amt ? formatMoney(amt) : "expense"}` :
                 mode === "income" ? `Add ${amt ? formatMoney(amt) : "income"}` :
                 `Transfer ${amt ? formatMoney(amt) : ""}`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
