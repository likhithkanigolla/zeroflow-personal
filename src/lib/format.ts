export const formatMoney = (n: number, currency = "₹", compact = false) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (compact && abs >= 100000) {
    if (abs >= 10000000) return `${sign}${currency}${(abs / 10000000).toFixed(2)}Cr`;
    return `${sign}${currency}${(abs / 100000).toFixed(2)}L`;
  }
  if (compact && abs >= 1000) return `${sign}${currency}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${currency}${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const greet = (name: string) => {
  const h = new Date().getHours();
  const t = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
  return `${t}, ${name}`;
};

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const colorToHsl: Record<string, string> = {
  emerald: "hsl(var(--emerald))",
  indigo: "hsl(var(--indigo))",
  sky: "hsl(var(--sky))",
  violet: "hsl(var(--violet))",
  amber: "hsl(var(--amber))",
  rose: "hsl(var(--rose))",
  primary: "hsl(var(--primary))",
};
