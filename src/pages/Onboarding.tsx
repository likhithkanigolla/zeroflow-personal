import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Wallet, CreditCard, PieChart, Sparkles, Check, Plus, X, Trash2 } from "lucide-react";
import { db, ensureSettings } from "@/lib/db";
import { useAccounts, useCards, useCategories, useSettings } from "@/hooks/useZeroFlow";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = ["emerald", "indigo", "sky", "violet", "amber", "rose"];
const DEFAULT_CATS = [
  { name: "Food", icon: "Utensils", color: "amber" },
  { name: "Rent", icon: "Home", color: "indigo" },
  { name: "Movies", icon: "Clapperboard", color: "violet" },
  { name: "Fuel", icon: "Fuel", color: "rose" },
  { name: "Shopping", icon: "ShoppingBag", color: "sky" },
  { name: "Savings", icon: "PiggyBank", color: "emerald" },
  { name: "Travel", icon: "Plane", color: "indigo" },
  { name: "Bills", icon: "Receipt", color: "amber" },
  { name: "Misc", icon: "MoreHorizontal", color: "violet" },
];

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function Onboarding() {
  const nav = useNavigate();
  const settings = useSettings();
  const accounts = useAccounts();
  const cards = useCards();
  const cats = useCategories();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");

  useEffect(() => { ensureSettings(); }, []);
  useEffect(() => { if (settings?.userName && settings.userName !== "Friend") setName(settings.userName); }, [settings?.userName]);

  const totalCash = accounts.reduce((s, a) => s + a.balance, 0);
  const totalAllocated = cats.reduce((s, c) => s + c.allocated, 0);
  const remaining = totalCash - totalAllocated;

  const finish = async () => {
    const s = await ensureSettings();
    // Seed default Cash Wallet if user hasn't added one
    const all = await db.accounts.toArray();
    if (!all.some(a => a.type === "cash")) {
      await db.accounts.add({
        name: "Cash Wallet", type: "cash", color: "amber",
        balance: 0, createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
    await db.settings.update(s.id!, { userName: name.trim() || "Friend", onboarded: true });
    toast.success("Welcome to ZeroFlow");
    nav("/", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh opacity-50 pointer-events-none" />
      <div className="relative max-w-md mx-auto min-h-dvh flex flex-col safe-top px-5 pt-8 pb-8">
        <div className="flex items-center gap-2 mb-6">
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && (
              <div className="flex-1 flex flex-col justify-center text-center space-y-6">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="mx-auto h-24 w-24 rounded-3xl bg-gradient-primary grid place-items-center shadow-glow"
                >
                  <Sparkles className="h-12 w-12 text-primary-foreground" />
                </motion.div>
                <div>
                  <h1 className="font-display text-4xl font-bold tracking-tight">ZeroFlow</h1>
                  <p className="text-muted-foreground mt-2 text-lg">Every rupee, a purpose.</p>
                </div>
                <p className="text-sm text-muted-foreground/80 max-w-xs mx-auto">
                  Premium personal budgeting. 100% on your device. Beautifully offline.
                </p>
                <div className="space-y-3 pt-4">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                    className="w-full bg-secondary rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary text-center text-lg"
                  />
                  <PrimaryBtn onClick={() => setStep(1)} disabled={!name.trim()}>Begin</PrimaryBtn>
                </div>
              </div>
            )}

            {step === 1 && (
              <StepWrap
                eyebrow="Step 1"
                title="Add bank accounts"
                desc="Enter your real bank balances. They live only on this device."
              >
                <AccountsEditor />
                <Footer onBack={() => setStep(0)} onNext={() => setStep(2)} disabled={accounts.length === 0} />
              </StepWrap>
            )}

            {step === 2 && (
              <StepWrap eyebrow="Step 2" title="Credit cards" desc="Optional. Helps us track liabilities and dues.">
                <CardsEditor />
                <Footer onBack={() => setStep(1)} onNext={() => setStep(3)} />
              </StepWrap>
            )}

            {step === 3 && (
              <StepWrap eyebrow="Step 3" title="Pick your categories" desc="Choose the buckets you'll budget into this month.">
                <CategoriesPicker />
                <Footer onBack={() => setStep(2)} onNext={() => setStep(4)} disabled={cats.length === 0} />
              </StepWrap>
            )}

            {step === 4 && (
              <StepWrap eyebrow="Step 4" title="Allocate every rupee" desc={
                <>You have <span className="text-primary font-semibold num">{formatMoney(totalCash, "₹", true)}</span> in cash. Distribute it across categories.</>
              }>
                <AllocationEditor remaining={remaining} totalCash={totalCash} />
                <Footer
                  onBack={() => setStep(3)}
                  onNext={() => setStep(5)}
                  disabled={totalAllocated === 0}
                  nextLabel={remaining > 0 ? `Continue (${formatMoney(remaining, "₹", true)} left)` : remaining < 0 ? `Over by ${formatMoney(-remaining, "₹", true)}` : "Continue"}
                />
              </StepWrap>
            )}

            {step === 5 && (
              <div className="flex-1 flex flex-col justify-center text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                  className="mx-auto h-24 w-24 rounded-full bg-gradient-primary grid place-items-center shadow-glow"
                >
                  <Check className="h-12 w-12 text-primary-foreground" strokeWidth={3} />
                </motion.div>
                <div>
                  <h2 className="font-display text-3xl font-bold">You're set, {name}.</h2>
                  <p className="text-muted-foreground mt-2">Your money has a plan now.</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Stat label="Cash" value={formatMoney(totalCash, "₹", true)} />
                  <Stat label="Allocated" value={formatMoney(totalAllocated, "₹", true)} />
                  <Stat label="Cards" value={String(cards.length)} />
                </div>
                <PrimaryBtn onClick={finish}>Open ZeroFlow <ArrowRight className="h-4 w-4 ml-1" /></PrimaryBtn>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepWrap({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">{eyebrow}</p>
        <h2 className="font-display text-3xl font-bold mt-1">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{desc}</p>
      </div>
      <div className="flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Footer({ onBack, onNext, disabled, nextLabel }: { onBack: () => void; onNext: () => void; disabled?: boolean; nextLabel?: string }) {
  return (
    <div className="flex gap-2 pt-3">
      <button onClick={onBack} className="px-5 py-3 rounded-2xl bg-secondary text-sm font-medium">Back</button>
      <button
        onClick={onNext}
        disabled={disabled}
        className="flex-1 py-3 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-1"
      >
        {nextLabel ?? "Continue"} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-1"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-lg num mt-1">{value}</div>
    </div>
  );
}

function AccountsEditor() {
  const accounts = useAccounts();
  const [n, setN] = useState(""); const [b, setB] = useState(""); const [color, setColor] = useState("emerald");
  const add = async () => {
    if (!n.trim()) return;
    await db.accounts.add({ name: n.trim(), type: "bank", color, balance: Number(b) || 0, createdAt: Date.now(), updatedAt: Date.now() });
    setN(""); setB("");
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Bank name" className="bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
        <input value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" placeholder="Balance ₹" className="bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary num" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={cn("h-7 w-7 rounded-full transition-transform", color === c && "ring-2 ring-foreground scale-110")}
              style={{ background: `hsl(var(--${c}))` }} />
          ))}
        </div>
        <button onClick={add} className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground flex items-center gap-1 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <div className="space-y-2 pt-1">
        {accounts.map((a) => (
          <div key={a.id} className="glass-card p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl" style={{ background: `linear-gradient(135deg, hsl(var(--${a.color})), hsl(var(--${a.color}) / 0.6))` }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{a.name}</div>
              <div className="text-xs text-muted-foreground num">{formatMoney(a.balance)}</div>
            </div>
            <button onClick={() => db.accounts.delete(a.id!)} className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {accounts.length === 0 && <EmptyHint icon={<Wallet className="h-5 w-5" />} text="Add at least one account to continue" />}
      </div>
    </div>
  );
}

function CardsEditor() {
  const cards = useCards();
  const [n, setN] = useState(""); const [limit, setLimit] = useState(""); const [out, setOut] = useState(""); const [color, setColor] = useState("indigo");
  const add = async () => {
    if (!n.trim()) return;
    await db.creditCards.add({ name: n.trim(), bank: n.trim(), color, limit: Number(limit) || 100000, outstanding: Number(out) || 0, dueDay: 5, statementDay: 25 });
    setN(""); setLimit(""); setOut("");
  };
  return (
    <div className="space-y-3">
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Card name (e.g. HDFC Millennia)" className="w-full bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent" />
      <div className="grid grid-cols-2 gap-2">
        <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="Limit ₹" className="bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent num" />
        <input value={out} onChange={(e) => setOut(e.target.value)} inputMode="decimal" placeholder="Outstanding ₹" className="bg-secondary rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent num" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={cn("h-7 w-7 rounded-full transition-transform", color === c && "ring-2 ring-foreground scale-110")}
              style={{ background: `hsl(var(--${c}))` }} />
          ))}
        </div>
        <button onClick={add} className="h-11 px-4 rounded-2xl bg-accent text-accent-foreground flex items-center gap-1 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <div className="space-y-2 pt-1">
        {cards.map((c) => (
          <div key={c.id} className="glass-card p-3 flex items-center gap-3">
            <CreditCard className="h-5 w-5" style={{ color: `hsl(var(--${c.color}))` }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground num">Outstanding {formatMoney(c.outstanding)} of {formatMoney(c.limit)}</div>
            </div>
            <button onClick={() => db.creditCards.delete(c.id!)} className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {cards.length === 0 && <EmptyHint icon={<CreditCard className="h-5 w-5" />} text="Skip if you don't use credit cards" />}
      </div>
    </div>
  );
}

function CategoriesPicker() {
  const cats = useCategories();
  const has = (n: string) => cats.some((c) => c.name === n);
  const toggle = async (def: typeof DEFAULT_CATS[number]) => {
    const existing = cats.find((c) => c.name === def.name);
    if (existing) await db.categories.delete(existing.id!);
    else await db.categories.add({ name: def.name, icon: def.icon, color: def.color, allocated: 0, spent: 0, rollover: true });
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {DEFAULT_CATS.map((c) => {
        const on = has(c.name);
        return (
          <button
            key={c.name}
            onClick={() => toggle(c)}
            className={cn(
              "p-3 rounded-2xl border text-sm font-medium transition-all flex flex-col items-center gap-1",
              on ? "border-primary bg-primary/10 text-foreground" : "border-white/5 bg-secondary text-muted-foreground"
            )}
          >
            <div className="h-8 w-8 rounded-xl grid place-items-center" style={{ background: `hsl(var(--${c.color}) / 0.2)`, color: `hsl(var(--${c.color}))` }}>
              <span className="text-xs font-bold">{c.name[0]}</span>
            </div>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function AllocationEditor({ remaining, totalCash }: { remaining: number; totalCash: number }) {
  const cats = useCategories();
  const update = async (id: number, val: number) => {
    await db.categories.update(id, { allocated: Math.max(0, val) });
  };
  const autoSplit = async () => {
    if (cats.length === 0) return;
    const each = Math.floor(totalCash / cats.length);
    for (const c of cats) await db.categories.update(c.id!, { allocated: each });
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between glass-card p-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Remaining</div>
          <div className={cn("font-display font-bold text-xl num", remaining < 0 ? "text-destructive" : "text-primary")}>{formatMoney(remaining)}</div>
        </div>
        <button onClick={autoSplit} className="text-xs px-3 py-2 rounded-xl bg-secondary font-medium">Auto-split</button>
      </div>
      <div className="space-y-2 max-h-[44vh] overflow-y-auto no-scrollbar">
        {cats.map((c) => (
          <div key={c.id} className="glass-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg" style={{ background: `hsl(var(--${c.color}) / 0.2)` }} />
                <span className="font-medium">{c.name}</span>
              </div>
              <input
                value={c.allocated || ""}
                onChange={(e) => update(c.id!, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                inputMode="numeric"
                placeholder="0"
                className="w-28 bg-secondary rounded-xl px-3 py-2 text-right num font-semibold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="glass-card p-4 flex items-center gap-3 text-muted-foreground text-sm">
      <div className="h-8 w-8 rounded-xl bg-secondary grid place-items-center">{icon}</div>
      {text}
    </div>
  );
}
