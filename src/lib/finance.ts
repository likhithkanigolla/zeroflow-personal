import { db, type Transaction, type Account, type CreditCard, type Category } from "./db";

export const monthKey = (d: Date | number = new Date()) => {
  const dt = typeof d === "number" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();

export interface ExpenseInput {
  amount: number;
  categoryId: number;
  pay: { kind: "account" | "card"; id: number };
  merchant?: string;
  notes?: string;
  date?: number;
}

export async function addExpense(input: ExpenseInput) {
  const date = input.date ?? Date.now();
  return db.transaction("rw", [db.transactions, db.accounts, db.creditCards, db.categories], async () => {
    const txnId = await db.transactions.add({
      amount: input.amount,
      type: "expense",
      categoryId: input.categoryId,
      accountId: input.pay.kind === "account" ? input.pay.id : undefined,
      cardId: input.pay.kind === "card" ? input.pay.id : undefined,
      merchant: input.merchant,
      notes: input.notes,
      date,
      createdAt: Date.now(),
    });
    // Update category spent
    const cat = await db.categories.get(input.categoryId);
    if (cat) await db.categories.update(input.categoryId, { spent: (cat.spent ?? 0) + input.amount });
    if (input.pay.kind === "account") {
      const a = await db.accounts.get(input.pay.id);
      if (a) await db.accounts.update(input.pay.id, { balance: a.balance - input.amount, updatedAt: Date.now() });
    } else {
      const c = await db.creditCards.get(input.pay.id);
      if (c) await db.creditCards.update(input.pay.id, { outstanding: c.outstanding + input.amount });
    }
    return txnId;
  });
}

export async function addIncome(accountId: number, amount: number, notes?: string) {
  return db.transaction("rw", [db.transactions, db.accounts], async () => {
    await db.transactions.add({
      amount: -amount,
      type: "income",
      accountId,
      notes,
      date: Date.now(),
      createdAt: Date.now(),
    });
    const a = await db.accounts.get(accountId);
    if (a) await db.accounts.update(accountId, { balance: a.balance + amount, updatedAt: Date.now() });
  });
}

export async function payCard(cardId: number, accountId: number, amount: number) {
  return db.transaction("rw", [db.transactions, db.accounts, db.creditCards], async () => {
    await db.transactions.add({
      amount,
      type: "cardPayment",
      accountId,
      cardId,
      date: Date.now(),
      createdAt: Date.now(),
    });
    const a = await db.accounts.get(accountId);
    if (a) await db.accounts.update(accountId, { balance: a.balance - amount, updatedAt: Date.now() });
    const c = await db.creditCards.get(cardId);
    if (c) await db.creditCards.update(cardId, { outstanding: Math.max(0, c.outstanding - amount) });
  });
}

export async function addReimbursement(amount: number, source: string, restoreCategoryId?: number) {
  return db.transaction("rw", [db.transactions, db.reimbursements, db.categories], async () => {
    const txnId = await db.transactions.add({
      amount: -amount,
      type: "reimbursement",
      categoryId: restoreCategoryId,
      notes: `Reimbursement from ${source}`,
      date: Date.now(),
      createdAt: Date.now(),
    });
    await db.reimbursements.add({
      amount,
      source,
      relatedTxnId: txnId,
      resolved: !!restoreCategoryId,
      date: Date.now(),
    });
    if (restoreCategoryId) {
      const cat = await db.categories.get(restoreCategoryId);
      if (cat) await db.categories.update(restoreCategoryId, { spent: Math.max(0, cat.spent - amount) });
    }
  });
}

export async function reallocate(fromId: number, toId: number, amount: number) {
  const from = await db.categories.get(fromId);
  const to = await db.categories.get(toId);
  if (!from || !to) return;
  await db.categories.update(fromId, { allocated: Math.max(0, from.allocated - amount) });
  await db.categories.update(toId, { allocated: to.allocated + amount });
}

export async function recompute() {
  // Recalculate spent per category from transactions in current month
  const since = startOfMonth();
  const txns = await db.transactions.where("date").aboveOrEqual(since).toArray();
  const catSpent = new Map<number, number>();
  for (const t of txns) {
    if (t.type === "expense" && t.categoryId) {
      catSpent.set(t.categoryId, (catSpent.get(t.categoryId) ?? 0) + t.amount);
    }
    if (t.type === "reimbursement" && t.categoryId) {
      catSpent.set(t.categoryId, (catSpent.get(t.categoryId) ?? 0) + t.amount); // amount is negative
    }
  }
  const cats = await db.categories.toArray();
  await Promise.all(
    cats.map((c) => db.categories.update(c.id!, { spent: Math.max(0, catSpent.get(c.id!) ?? 0) }))
  );
  return true;
}

export interface Totals {
  cash: number;
  allocated: number;
  outstanding: number;
  net: number;
  spentThisMonth: number;
  savingsLeft: number;
}

export function computeTotals(accounts: Account[], cards: CreditCard[], categories: Category[], txns: Transaction[]): Totals {
  const cash = accounts.reduce((s, a) => s + a.balance, 0);
  const allocated = categories.reduce((s, c) => s + c.allocated, 0);
  const outstanding = cards.reduce((s, c) => s + c.outstanding, 0);
  const since = startOfMonth();
  const spentThisMonth = txns
    .filter((t) => t.date >= since && t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const savingsCat = categories.find((c) => /sav/i.test(c.name));
  const savingsLeft = savingsCat ? Math.max(0, savingsCat.allocated - savingsCat.spent) : 0;
  return { cash, allocated, outstanding, net: cash - outstanding, spentThisMonth, savingsLeft };
}
