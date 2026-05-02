import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSettings } from "@/hooks/useZeroFlow";
import { db, ensureSettings } from "@/lib/db";
import Onboarding from "./Onboarding";
import Dashboard from "./Dashboard";
import Accounts from "./Accounts";
import Budget from "./Budget";
import Cards from "./Cards";
import Insights from "./Insights";
import Settings from "./Settings";
import Savings from "./Savings";
import Reimbursements from "./Reimbursements";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function Index() {
  const settings = useSettings();
  const location = useLocation();

  useEffect(() => { ensureSettings(); }, []);
  useEffect(() => {
    if (settings) document.documentElement.classList.toggle("light", settings.theme === "light");
  }, [settings?.theme]);
  // Auto-seed Cash Wallet for users onboarded before this feature shipped
  useEffect(() => {
    if (!settings?.onboarded) return;
    (async () => {
      const all = await db.accounts.toArray();
      if (!all.some(a => a.type === "cash")) {
        await db.accounts.add({
          name: "Cash Wallet", type: "cash", color: "amber",
          balance: 0, createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
    })();
  }, [settings?.onboarded]);

  // Block until settings load
  if (settings === undefined) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-12 w-12 rounded-2xl bg-gradient-primary animate-pulse-soft" />
      </div>
    );
  }

  const onboarded = settings?.onboarded;
  const isOnboarding = location.pathname === "/onboarding";

  if (!onboarded && !isOnboarding) return <Navigate to="/onboarding" replace />;
  if (onboarded && isOnboarding) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      {onboarded && <BottomNav />}
      {onboarded && <InstallPrompt />}
    </div>
  );
}
