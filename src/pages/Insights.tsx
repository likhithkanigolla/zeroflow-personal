import { useMemo } from "react";
import { motion } from "framer-motion";
import { useCards, useCategories, useTransactions } from "@/hooks/useZeroFlow";
import { formatMoney } from "@/lib/format";
import { startOfMonth } from "@/lib/finance";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, YAxis, CartesianGrid,
} from "recharts";

export default function Insights() {
  const cats = useCategories();
  const cards = useCards();
  const txns = useTransactions(1000);

  const since = startOfMonth();
  const lastMonthStart = new Date(); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1, 1); lastMonthStart.setHours(0,0,0,0);
  const lastMonthEnd = startOfMonth();

  const byCat = cats.map((c) => ({
    name: c.name,
    value: txns.filter((t) => t.categoryId === c.id && t.type === "expense" && t.date >= since).reduce((s, t) => s + t.amount, 0),
    color: `hsl(var(--${c.color}))`,
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const weekly = useMemo(() => {
    const out: { week: string; spent: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(); start.setDate(start.getDate() - i * 7); start.setHours(0,0,0,0);
      const end = start.getTime() + 7 * 86400000;
      const spent = txns.filter((t) => t.type === "expense" && t.date >= start.getTime() && t.date < end).reduce((s, t) => s + t.amount, 0);
      out.push({ week: `W${8-i}`, spent });
    }
    return out;
  }, [txns]);

  const thisMonth = txns.filter(t => t.type === "expense" && t.date >= since).reduce((s,t) => s + t.amount, 0);
  const lastMonth = txns.filter(t => t.type === "expense" && t.date >= lastMonthStart.getTime() && t.date < lastMonthEnd).reduce((s,t)=>s+t.amount,0);
  const delta = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;

  const cardSpend = txns.filter(t => t.type === "expense" && t.cardId && t.date >= since).reduce((s,t)=>s+t.amount,0);
  const cardDep = thisMonth ? Math.round((cardSpend / thisMonth) * 100) : 0;

  const merchantStats = useMemo(() => {
    const map = new Map<string, { spent: number; count: number; lastDate: number; thisMonth: number }>();
    for (const t of txns) {
      if (t.type !== "expense" || !t.merchant) continue;
      const cur = map.get(t.merchant) ?? { spent: 0, count: 0, lastDate: 0, thisMonth: 0 };
      cur.spent += t.amount;
      cur.count += 1;
      cur.lastDate = Math.max(cur.lastDate, t.date);
      if (t.date >= since) cur.thisMonth += t.amount;
      map.set(t.merchant, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.spent - a.spent);
  }, [txns, since]);
  const topMerchants = merchantStats.slice(0, 8);

  return (
    <div className="pb-32 px-5 pt-6 safe-top space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Insights</p>
        <h1 className="font-display text-3xl font-bold mt-1">Where it goes</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="This month" value={formatMoney(thisMonth, "₹", true)} sub={`${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs last`} />
        <Stat label="Card dependency" value={`${cardDep}%`} sub={formatMoney(cardSpend, "₹", true)} />
      </div>

      <Section title="Spend by category" subtitle="This month">
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCat} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={70} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatMoney(v), "Spent"]} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                {byCat.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Weekly trend" subtitle="Last 8 weeks">
        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatMoney(v), "Spent"]} />
              <Line type="monotone" dataKey="spent" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Allocation" subtitle="Budget shape">
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={cats.map(c => ({ name: c.name, value: c.allocated, color: `hsl(var(--${c.color}))` }))} dataKey="value" innerRadius={36} outerRadius={70} paddingAngle={2} stroke="none">
                  {cats.map((c, i) => <Cell key={i} fill={`hsl(var(--${c.color}))`} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatMoney(v), "Allocated"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Top merchants" subtitle="All time">
          <div className="space-y-2 mt-1">
            {topMerchants.length === 0 && <p className="text-sm text-muted-foreground">Add merchant names to expenses to see this.</p>}
            {topMerchants.map(([name, amt], i) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-secondary grid place-items-center text-[10px] font-bold text-muted-foreground">{i+1}</span>
                  <span className="truncate">{name}</span>
                </div>
                <span className="num font-semibold">{formatMoney(amt, "₹", true)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold num mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-2">
        <div className="font-display font-bold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
