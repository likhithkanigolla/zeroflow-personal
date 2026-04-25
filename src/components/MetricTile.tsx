import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  delta,
  icon,
  tone = "primary",
  sub,
  delay = 0,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "accent" | "warm" | "cool";
  sub?: ReactNode;
  delay?: number;
  className?: string;
}) {
  const toneBg: Record<string, string> = {
    primary: "bg-gradient-primary",
    accent: "bg-gradient-accent",
    warm: "bg-gradient-warm",
    cool: "bg-gradient-cool",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("metric-tile", className)}
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">{label}</p>
          <div className="text-2xl font-display font-bold num leading-tight">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
        {icon && (
          <div className={cn("h-10 w-10 rounded-2xl grid place-items-center text-primary-foreground shadow-glow shrink-0", toneBg[tone])}>
            {icon}
          </div>
        )}
      </div>
      {delta && <div className="mt-3 text-xs relative z-10">{delta}</div>}
    </motion.div>
  );
}
