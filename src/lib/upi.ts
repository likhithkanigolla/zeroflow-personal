// Utility to generate a UPI deeplink URL from payee, amount, and note
export function makeUpiUrl({ pa, pn, amount, note }: { pa: string, pn?: string, amount: number, note?: string }) {
  const params = [
    `pa=${encodeURIComponent(pa)}`,
    pn ? `pn=${encodeURIComponent(pn)}` : null,
    `am=${encodeURIComponent(amount.toFixed(2))}`,
    note ? `tn=${encodeURIComponent(note)}` : null,
    "cu=INR"
  ].filter(Boolean).join("&");
  return `upi://pay?${params}`;
}
