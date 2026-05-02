import { db, type Transaction, type Account, type CreditCard, type Category, type SplitMeta } from "./db";

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
  isShared?: boolean;
  splitMeta?: SplitMeta;
}

/* ------------ EXPENSE ------------ */
export async function addExpense(input: ExpenseInput) {
  const date = input.date ?? Date.now();
  return db.transaction(
    "rw",
    [db.transactions, db.accounts, db.creditCards, db.categories, db.reimbursements],
    async () => {
      const txnId = await db.transactions.add({
        amount: input.amount,
        type: "expense",
        categoryId: input.categoryId,
        accountId: input.pay.kind === "account" ? input.pay.id : undefined,
        cardId: input.pay.kind === "card" ? input.pay.id : undefined,
        merchant: input.merchant,
        notes: input.notes,
        isShared: input.isShared,
        splitMeta: input.splitMeta,
        date,
        createdAt: Date.now(),
      });
      const cat = await db.categories.get(input.categoryId);
      if (cat) await db.categories.update(input.categoryId, { spent: (cat.spent ?? 0) + input.amount });
      if (input.pay.kind === "account") {
        const a = await db.accounts.get(input.pay.id);
        if (a) await db.accounts.update(input.pay.id, { balance: a.balance - input.amount, updatedAt: Date.now() });
      } else {
        const c = await db.creditCards.get(input.pay.id);
        if (c) await db.creditCards.update(input.pay.id, { outstanding: c.outstanding + input.amount });
      }
      // Create pending reimbursement for shared expense
      if (input.isShared && input.splitMeta && input.splitMeta.othersShare > 0) {
        await db.reimbursements.add({
          amount: input.splitMeta.othersShare,
          source: input.merchant || "Group",
          categoryId: input.categoryId,
          relatedTxnId: txnId,
          linkedTransactionId: txnId,
          status: "pending",
          resolved: false,
          date,
        });
      }
      return txnId;
    }
  );
}

/* ------------ INCOME ------------ */
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

/* ------------ TRANSFER (between own accounts) ------------ */
export async function addTransfer(fromAccountId: number, toAccountId: number, amount: number, notes?: string) {
  if (fromAccountId === toAccountId) throw new Error("Choose different accounts");
  if (amount <= 0) throw new Error("Amount must be positive");
  return db.transaction("rw", [db.transactions, db.accounts], async () => {
    await db.transactions.add({
      amount,
      type: "transfer",
      accountId: fromAccountId,
      toAccountId,
      notes,
      date: Date.now(),
      createdAt: Date.now(),
    });
    const from = await db.accounts.get(fromAccountId);
    const to = await db.accounts.get(toAccountId);
    if (from) await db.accounts.update(fromAccountId, { balance: from.balance - amount, updatedAt: Date.now() });
    if (to) await db.accounts.update(toAccountId, { balance: to.balance + amount, updatedAt: Date.now() });
  });
}

/* ------------ CARD PAYMENT ------------ */
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

/* ------------ REIMBURSEMENT (manual: someone paid me back) ------------ */
export async function addReimbursement(amount: number, source: string, restoreCategoryId?: number, toAccountId?: number) {
  return db.transaction(
    "rw",
    [db.transactions, db.reimbursements, db.categories, db.accounts],
    async () => {
      const txnId = await db.transactions.add({
        amount: -amount,
        type: "reimbursement",
        categoryId: restoreCategoryId,
        accountId: toAccountId,
        notes: `Reimbursement from ${source}`,
        date: Date.now(),
        createdAt: Date.now(),
      });
      await db.reimbursements.add({
        amount,
        source,
        categoryId: restoreCategoryId,
        relatedTxnId: txnId,
        linkedTransactionId: txnId,
        status: "settled",
        resolved: true,
        date: Date.now(),
      });
      if (restoreCategoryId) {
        const cat = await db.categories.get(restoreCategoryId);
        if (cat) await db.categories.update(restoreCategoryId, { spent: Math.max(0, cat.spent - amount) });
      }
      if (toAccountId) {
        const a = await db.accounts.get(toAccountId);
        if (a) await db.accounts.update(toAccountId, { balance: a.balance + amount, updatedAt: Date.now() });
      }
    }
  );
}

/* ------------ SETTLE PENDING REIMBURSEMENT ------------ */
export type SettleAction =
  | { kind: "restoreCategory"; toAccountId: number }
  | { kind: "addToBalance"; toAccountId: number }
  | { kind: "manual"; toAccountId: number; categoryId: number; amount: number };

export async function settleReimbursement(reimbId: number, action: SettleAction) {
  const r = await db.reimbursements.get(reimbId);
  if (!r) return;
  return db.transaction(
    "rw",
    [db.reimbursements, db.transactions, db.accounts, db.categories],
    async () => {
      // Always increase the receiving account
      const acc = await db.accounts.get(action.toAccountId);
      if (acc) await db.accounts.update(action.toAccountId, { balance: acc.balance + r.amount, updatedAt: Date.now() });

      const txnId = await db.transactions.add({
        amount: -r.amount,
        type: "reimbursement",
        accountId: action.toAccountId,
        categoryId:
          action.kind === "restoreCategory" ? r.categoryId :
          action.kind === "manual" ? action.categoryId : undefined,
        notes: `Reimbursement settled · ${r.source}`,
        date: Date.now(),
        createdAt: Date.now(),
      });

      if (action.kind === "restoreCategory" && r.categoryId) {
        const cat = await db.categories.get(r.categoryId);
        if (cat) await db.categories.update(r.categoryId, { spent: Math.max(0, cat.spent - r.amount) });
      }
      if (action.kind === "manual") {
        const cat = await db.categories.get(action.categoryId);
        if (cat) await db.categories.update(action.categoryId, { spent: Math.max(0, cat.spent - action.amount) });
      }

      await db.reimbursements.update(reimbId, {
        status: "settled",
        resolved: true,
        linkedTransactionId: txnId,
      });
    }
  );
}

/* ------------ EDIT / DELETE TRANSACTION (full reversal + reapply) ------------ */
async function reverseTxn(t: Transaction) {
  if (t.type === "expense") {
    if (t.categoryId) {
      const c = await db.categories.get(t.categoryId);
      if (c) await db.categories.update(t.categoryId, { spent: Math.max(0, c.spent - t.amount) });
    }
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance + t.amount });
    }
    if (t.cardId) {
      const c = await db.creditCards.get(t.cardId);
      if (c) await db.creditCards.update(t.cardId, { outstanding: Math.max(0, c.outstanding - t.amount) });
    }
  } else if (t.type === "income") {
    const amt = Math.abs(t.amount);
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance - amt });
    }
  } else if (t.type === "transfer") {
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance + t.amount });
    }
    if (t.toAccountId) {
      const a = await db.accounts.get(t.toAccountId);
      if (a) await db.accounts.update(t.toAccountId, { balance: a.balance - t.amount });
    }
  } else if (t.type === "cardPayment") {
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance + t.amount });
    }
    if (t.cardId) {
      const c = await db.creditCards.get(t.cardId);
      if (c) await db.creditCards.update(t.cardId, { outstanding: c.outstanding + t.amount });
    }
  } else if (t.type === "reimbursement") {
    const amt = Math.abs(t.amount);
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance - amt });
    }
    if (t.categoryId) {
      const c = await db.categories.get(t.categoryId);
      if (c) await db.categories.update(t.categoryId, { spent: c.spent + amt });
    }
  }
}

async function applyTxn(t: Transaction) {
  if (t.type === "expense") {
    if (t.categoryId) {
      const c = await db.categories.get(t.categoryId);
      if (c) await db.categories.update(t.categoryId, { spent: c.spent + t.amount });
    }
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance - t.amount });
    }
    if (t.cardId) {
      const c = await db.creditCards.get(t.cardId);
      if (c) await db.creditCards.update(t.cardId, { outstanding: c.outstanding + t.amount });
    }
  } else if (t.type === "income") {
    const amt = Math.abs(t.amount);
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance + amt });
    }
  } else if (t.type === "transfer") {
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance - t.amount });
    }
    if (t.toAccountId) {
      const a = await db.accounts.get(t.toAccountId);
      if (a) await db.accounts.update(t.toAccountId, { balance: a.balance + t.amount });
    }
  } else if (t.type === "cardPayment") {
    if (t.accountId) {
      const a = await db.accounts.get(t.accountId);
      if (a) await db.accounts.update(t.accountId, { balance: a.balance - t.amount });
    }
    if (t.cardId) {
      const c = await db.creditCards.get(t.cardId);
      if (c) await db.creditCards.update(t.cardId, { outstanding: Math.max(0, c.outstanding - t.amount) });
    }
  }
}

export async function deleteTransaction(id: number) {
  return db.transaction(
    "rw",
    [db.transactions, db.accounts, db.creditCards, db.categories, db.reimbursements],
    async () => {
      const t = await db.transactions.get(id);
      if (!t) return;
      await reverseTxn(t);
      // Remove any reimbursement linked to this txn
      const linked = await db.reimbursements.where("relatedTxnId").equals(id).toArray();
      for (const r of linked) await db.reimbursements.delete(r.id!);
      await db.transactions.delete(id);
    }
  );
}

export interface EditTxnPatch {
  amount?: number;
  type?: Transaction["type"];
  categoryId?: number | null;
  accountId?: number | null;
  toAccountId?: number | null;
  cardId?: number | null;
  merchant?: string;
  notes?: string;
}

export async function editTransaction(id: number, patch: EditTxnPatch) {
  return db.transaction(
    "rw",
    [db.transactions, db.accounts, db.creditCards, db.categories],
    async () => {
      const old = await db.transactions.get(id);
      if (!old) return;
      await reverseTxn(old);

      const next: Transaction = { ...old };
      if (patch.type) next.type = patch.type;
      if (patch.amount != null) {
        next.amount = next.type === "income" ? -Math.abs(patch.amount) : Math.abs(patch.amount);
      }
      if (patch.categoryId !== undefined) next.categoryId = patch.categoryId ?? undefined;
      if (patch.accountId !== undefined) next.accountId = patch.accountId ?? undefined;
      if (patch.toAccountId !== undefined) next.toAccountId = patch.toAccountId ?? undefined;
      if (patch.cardId !== undefined) next.cardId = patch.cardId ?? undefined;
      if (patch.merchant !== undefined) next.merchant = patch.merchant;
      if (patch.notes !== undefined) next.notes = patch.notes;

      // Cleanup mutually-exclusive fields by type
      if (next.type === "expense") next.toAccountId = undefined;
      if (next.type === "income") { next.cardId = undefined; next.categoryId = undefined; next.toAccountId = undefined; }
      if (next.type === "transfer") { next.cardId = undefined; next.categoryId = undefined; }

      await applyTxn(next);
      await db.transactions.put(next);
    }
  );
}

/* ------------ SAVINGS GOALS ------------ */
export async function allocateToGoal(goalId: number, amount: number, fromAccountId: number) {
  return db.transaction("rw", [db.savingsGoals, db.accounts], async () => {
    const g = await db.savingsGoals.get(goalId);
    const a = await db.accounts.get(fromAccountId);
    if (!g || !a) return;
    await db.savingsGoals.update(goalId, { allocatedAmount: g.allocatedAmount + amount });
    await db.accounts.update(fromAccountId, { balance: a.balance - amount, updatedAt: Date.now() });
  });
}

export async function withdrawFromGoal(goalId: number, amount: number, toAccountId: number) {
  return db.transaction("rw", [db.savingsGoals, db.accounts], async () => {
    const g = await db.savingsGoals.get(goalId);
    const a = await db.accounts.get(toAccountId);
    if (!g || !a) return;
    const take = Math.min(amount, g.allocatedAmount);
    await db.savingsGoals.update(goalId, { allocatedAmount: g.allocatedAmount - take });
    await db.accounts.update(toAccountId, { balance: a.balance + take, updatedAt: Date.now() });
  });
}

/* ------------ REALLOCATE BUDGET ------------ */
export async function reallocate(fromId: number, toId: number, amount: number) {
  const from = await db.categories.get(fromId);
  const to = await db.categories.get(toId);
  if (!from || !to) return;
  await db.categories.update(fromId, { allocated: Math.max(0, from.allocated - amount) });
  await db.categories.update(toId, { allocated: to.allocated + amount });
}

/* ------------ FULL RECOMPUTE ENGINE ------------ */
export async function recompute() {
  const since = startOfMonth();
  const txns = await db.transactions.where("date").aboveOrEqual(since).toArray();
  const catSpent = new Map<number, number>();
  for (const t of txns) {
    if (t.type === "expense" && t.categoryId) {
      catSpent.set(t.categoryId, (catSpent.get(t.categoryId) ?? 0) + t.amount);
    }
    if (t.type === "reimbursement" && t.categoryId) {
      catSpent.set(t.categoryId, (catSpent.get(t.categoryId) ?? 0) + t.amount); // amount negative
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
