// Inert shadcn chart shim — Recharts v3 broke the original wrapper types.
// ZeroFlow uses Recharts directly; this just keeps imports happy.
import * as React from "react";
import * as RechartsPrimitive from "recharts";

export const ChartContainer = ({ children, className }: { children?: React.ReactNode; className?: string; config?: unknown }) =>
  React.createElement("div", { className }, children);
export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartTooltipContent = (() => null) as unknown as React.FC;
export const ChartLegend = RechartsPrimitive.Legend;
export const ChartLegendContent = (() => null) as unknown as React.FC;
export const ChartStyle = (() => null) as unknown as React.FC;
export type ChartConfig = Record<string, { label?: string; color?: string }>;
