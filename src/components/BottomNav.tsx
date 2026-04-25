import { NavLink, useLocation } from "react-router-dom";
import { Home, Wallet, PieChart, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom px-3 pt-2">
      <div className="mx-auto max-w-md glass rounded-3xl px-2 py-2 shadow-elev">
        <ul className="grid grid-cols-5 gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <li key={to} className="relative">
                <NavLink to={to} className="flex flex-col items-center gap-1 py-2 rounded-2xl">
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-1 rounded-2xl bg-primary/10 border border-primary/20"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className={`relative h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} strokeWidth={active ? 2.4 : 1.8} />
                  <span className={`relative text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
