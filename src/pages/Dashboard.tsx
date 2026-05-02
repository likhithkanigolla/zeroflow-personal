import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote, CreditCard, TrendingUp, Wallet, AlertTriangle, Bell, Zap, RefreshCw, ArrowUpRight, ArrowDownRight, ChevronRight,
} from "lucide-react";
import { useAccounts, useCards, useCategories, useRecurringBills, useSettings, useTransactions } from "@/hooks/useZeroFlow";
import { computeTotals, monthKey, recompute, startOfMonth } from "@/lib/finance";
import { formatMoney, greet } from "@/lib/format";
import { MetricTile } from "@/components/MetricTile";
import { FloatingAdd } from "@/components/FloatingAdd";
import { AddExpenseSheet } from "@/components/AddExpenseSheet";
import { EditTransactionSheet } from "@/components/EditTransactionSheet";
import type { Transaction } from "@/lib/db";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, RadialBarChart, RadialBar } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Dashboard() {
  const settings = useSettings();
  const accounts = useAccounts();
  const cards = useCards();
  const cats = useCategories();
  const txns = useTransactions(500);
  const bills = useRecurringBills();
  const [addOpen, setAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

  const totals = useMemo(() => computeTotals(accounts, cards, cats, txns), [accounts, cards, cats, txns]);

  const donutData = cats.map((c) => ({ name: c.name, value: c.allocated, color: `hsl(var(--${c.color}))` }));

  const trendData = useMemo(() => {
    const days = 14;
    const today = new Date();
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i)); d.setHours(0,0,0,0);
      const next = d.getTime() + 86400000;
      const spent = txns.filter((t) => t.type === "expense" && t.date >= d.getTime() && t.date < next).reduce((s, t) => s + t.amount, 0);
      return { day: d.toLocaleDateString("en-IN", { day: "numeric" }), spent };
    });
  }, [txns]);

  const totalLimit = cards.reduce((s, c) => s + c.limit, 0) || 1;
  const utilPct = Math.min(100, Math.round((totals.outstanding / totalLimit) * 100));
  const radial = [{ name: "u", value: utilPct, fill: utilPct > 70 ? "hsl(var(--destructive))" : utilPct > 40 ? "hsl(var(--warning))" : "hsl(var(--primary))" }];

  const overspent = cats.filter((c) => c.allocated > 0 && c.spent > c.allocated);
  const upcoming = bills.filter((b) => b.active).slice(0, 3);
  const recent = txns.slice(0, 6);

  const onSync = async () => {
    setSyncing(true);
    await recompute();
    await new Promise((r) => setTimeout(r, 600));
    setSyncing(false);
    toast.success("Synced", { description: "Balances and budgets recalculated." });
  };

  const monthSpent = totals.spentThisMonth;
  const monthAllocated = totals.allocated || 1;
  const spendPct = Math.min(100, Math.round((monthSpent / monthAllocated) * 100));

  return (
    <div className="pb-32">
      {/* Hero */}
      <header className="px-5 pt-10 safe-top">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
          <Link to="/settings" aria-label="Profile" className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground font-bold text-lg">
            {settings?.userName ? settings.userName[0].toUpperCase() : <span>U</span>}
          </Link>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{greet(settings?.userName ?? "Friend")}</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's where your money stands today.</p>
      </header>

      {/* Hero card */}
      <section className="px-5 mt-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
          className="relative overflow-hidden rounded-3xl bg-gradient-mesh border border-white/10 p-6 shadow-elev"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Net Position</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold num">{formatMoney(totals.net, "₹")}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-primary/15 text-primary font-semibold flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> {formatMoney(totals.cash, "₹", true)} cash
                </span>
                <span className="px-2 py-1 rounded-full bg-rose/15 text-rose-400 font-semibold flex items-center gap-1" style={{ color: "hsl(var(--rose))" }}>
                  <ArrowDownRight className="h-3 w-3" /> {formatMoney(totals.outstanding, "₹", true)} dues
                </span>
              </div>
            </div>
            <button onClick={onSync} className={cn("h-11 w-11 rounded-2xl bg-white/5 border border-white/10 grid place-items-center", syncing && "animate-spin")}>
              <RefreshCw className="h-5 w-5 text-primary" />
            </button>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>This month spent</span>
              <span className="num text-foreground font-semibold">{formatMoney(monthSpent)} / {formatMoney(totals.allocated, "₹", true)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${spendPct}%` }}
                transition={{ duration: 0.9, ease: [0.16,1,0.3,1] }}
                className={cn("h-full rounded-full", spendPct > 90 ? "bg-destructive" : spendPct > 70 ? "bg-warning" : "bg-gradient-primary")}
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Metric tiles */}
      <section className="px-5 mt-4 grid grid-cols-2 gap-3">
        <MetricTile delay={0.05} label="Total Cash" tone="primary" icon={<Wallet className="h-5 w-5" />} value={formatMoney(totals.cash, "₹", true)} sub={`${accounts.length} accounts`} />
        <MetricTile delay={0.1} label="Allocated" tone="accent" icon={<Banknote className="h-5 w-5" />} value={formatMoney(totals.allocated, "₹", true)} sub={`${cats.length} buckets`} />
        <MetricTile delay={0.15} label="Card Dues" tone="warm" icon={<CreditCard className="h-5 w-5" />} value={formatMoney(totals.outstanding, "₹", true)} sub={`${utilPct}% utilization`} />
        <MetricTile delay={0.2} label="Savings Left" tone="cool" icon={<TrendingUp className="h-5 w-5" />} value={formatMoney(totals.savingsLeft, "₹", true)} sub="this month" />
      </section>

      {/* Analytics */}
      <section className="px-5 mt-6 space-y-3">
        <SectionHeader title="Allocation" subtitle="Where every rupee goes" link="/budget" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Budget split</p>
                <div className="font-display text-2xl font-bold num mt-1">{formatMoney(totals.allocated, "₹", true)}</div>
              </div>
            </div>
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData.length ? donutData : [{ name: "—", value: 1, color: "hsl(var(--muted))" }]} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none">
                    {(donutData.length ? donutData : [{ color: "hsl(var(--muted))" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {donutData.slice(0, 4).map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">14-day spend</p>
                <div className="font-display text-2xl font-bold num mt-1">{formatMoney(trendData.reduce((s,d)=>s+d.spent,0), "₹", true)}</div>
              </div>
              <span className="text-xs text-primary font-semibold">trend</span>
            </div>
            <div className="h-44 mt-2 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [formatMoney(v), "Spent"]}
                  />
                  <Area type="monotone" dataKey="spent" stroke="hsl(var(--primary))" strokeWidth={2.4} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {cards.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Credit utilization</p>
                <div className="font-display text-2xl font-bold num mt-1">{utilPct}<span className="text-base text-muted-foreground">%</span></div>
              </div>
              <Link to="/cards" className="text-xs text-primary font-semibold flex items-center gap-1">Manage <ChevronRight className="h-3 w-3" /></Link>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={radial} startAngle={90} endAngle={-270}>
                  <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="px-5 mt-6">
        <SectionHeader title="Categories" subtitle="What's left this month" link="/budget" />
        <div className="space-y-2 mt-3">
          {cats.slice(0, 5).map((c) => {
            const left = c.allocated - c.spent;
            const pct = c.allocated ? Math.min(100, (c.spent / c.allocated) * 100) : 0;
            const over = left < 0;
            return (
              <div key={c.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: `hsl(var(--${c.color}) / 0.18)`, color: `hsl(var(--${c.color}))` }}>
                      <span className="text-xs font-bold">{c.name[0]}</span>
                    </div>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground num">{formatMoney(c.spent)} of {formatMoney(c.allocated)}</div>
                    </div>
                  </div>
                  <div className={cn("text-right num font-semibold", over ? "text-destructive" : "text-foreground")}>{formatMoney(left)}</div>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 mt-3 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "hsl(var(--destructive))" : `hsl(var(--${c.color}))` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Overspent */}
      {overspent.length > 0 && (
        <section className="px-5 mt-6">
          <div className="glass-card p-4 border border-destructive/30">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">Overspent in {overspent.length} {overspent.length === 1 ? "category" : "categories"}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {overspent.map((c) => (
                <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-destructive/15 text-destructive">{c.name} · {formatMoney(c.spent - c.allocated)}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent transactions */}
      <section className="px-5 mt-6">
        <SectionHeader title="Recent activity" subtitle="Last few movements" />
        <div className="glass-card mt-3 divide-y divide-white/5">
          {recent.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No transactions yet — tap + to add</div>}
          {recent.map((t) => {
            const cat = cats.find((c) => c.id === t.categoryId);
            const acc = accounts.find((a) => a.id === t.accountId);
            const toAcc = accounts.find((a) => a.id === t.toAccountId);
            const card = cards.find((c) => c.id === t.cardId);
            const isIncome = t.type === "income";
            const isTransfer = t.type === "transfer";
            const isReimb = t.type === "reimbursement";
            const sign = isIncome || isReimb ? "+" : isTransfer ? "" : "-";
            const tone = isIncome || isReimb ? "text-primary" : isTransfer ? "text-muted-foreground" : "text-foreground";
            return (
              <button
                key={t.id}
                onClick={() => setEditTxn(t)}
                className="w-full p-3.5 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0",
                  isIncome || isReimb ? "bg-primary/15 text-primary" :
                  isTransfer ? "bg-secondary text-muted-foreground" : "text-foreground")}
                  style={!isIncome && !isTransfer && !isReimb && cat ? { background: `hsl(var(--${cat.color}) / 0.18)`, color: `hsl(var(--${cat.color}))` } : undefined}
                >
                  {isIncome || isReimb ? <ArrowDownRight className="h-4 w-4" /> :
                   isTransfer ? <ArrowUpRight className="h-4 w-4" /> :
                   <span className="text-xs font-bold">{(cat?.name ?? "?")[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {isTransfer ? `${acc?.name ?? "—"} → ${toAcc?.name ?? "—"}` :
                     isReimb ? `Reimbursement · ${t.notes?.replace("Reimbursement from ", "") ?? ""}` :
                     (t.merchant || cat?.name || (isIncome ? "Income" : "Expense"))}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {!isTransfer && ` · ${acc?.name ?? card?.name ?? "—"}`}
                    {t.isShared && " · split"}
                  </div>
                </div>
                <div className={cn("font-semibold num text-sm", tone)}>{sign}{formatMoney(Math.abs(t.amount))}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick actions */}
      <section className="px-5 mt-6 grid grid-cols-2 gap-3">
        <Link to="/reimbursements" className="glass-card p-4 flex items-center gap-3 text-left">
          <div className="h-10 w-10 rounded-xl bg-gradient-accent grid place-items-center text-accent-foreground"><ArrowDownRight className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold text-sm">Reimbursements</div>
            <div className="text-xs text-muted-foreground">Money owed to you</div>
          </div>
        </Link>
        <button onClick={onSync} className="glass-card p-4 flex items-center gap-3 text-left">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center text-primary-foreground"><RefreshCw className={cn("h-5 w-5", syncing && "animate-spin")} /></div>
          <div>
            <div className="font-semibold text-sm">Sync</div>
            <div className="text-xs text-muted-foreground">Recompute totals</div>
          </div>
        </button>
      </section>

      <FloatingAdd onClick={() => setAddOpen(true)} />
      <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <EditTransactionSheet txn={editTxn} onClose={() => setEditTxn(null)} />
    </div>
  );
}

function SectionHeader({ title, subtitle, link }: { title: string; subtitle?: string; link?: string }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {link && <Link to={link} className="text-xs text-primary font-semibold flex items-center gap-1">View all <ChevronRight className="h-3 w-3" /></Link>}
    </div>
  );
}
