import Dexie, { type Table } from "dexie";

export type AccountType = "bank" | "wallet" | "cash";
export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  color: string; // token name: emerald|indigo|sky|violet|amber|rose
  balance: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreditCard {
  id?: number;
  name: string;
  bank: string;
  color: string;
  limit: number;
  outstanding: number;
  dueDay: number; // day of month
  statementDay: number;
  last4?: string;
}

export interface Category {
  id?: number;
  name: string;
  icon: string; // lucide name
  color: string; // token
  allocated: number;
  spent: number;
  rollover: boolean;
}

export type PayMethod = { kind: "account"; id: number } | { kind: "card"; id: number };

export interface SplitMeta {
  totalAmount: number;
  participants: number; // total people including user
  userShare: number;
  othersShare: number;
}

export interface Transaction {
  id?: number;
  amount: number; // positive=expense, negative=income; for transfer = absolute moved amount
  type: "expense" | "income" | "transfer" | "cardPayment" | "reimbursement";
  categoryId?: number;
  accountId?: number;       // source account (for transfer = FROM)
  toAccountId?: number;     // destination account (transfer only)
  cardId?: number;
  merchant?: string;
  notes?: string;
  isShared?: boolean;
  splitMeta?: SplitMeta;
  date: number;
  createdAt: number;
}

export interface SavingsGoal {
  id?: number;
  name: string;
  targetAmount: number;
  allocatedAmount: number;
  color: string;
  icon?: string;
  fromAccountId?: number;
  createdAt: number;
}

export interface Reimbursement {
  id?: number;
  amount: number;
  source: string; // who paid back
  relatedTxnId?: number;
  resolved: boolean;
  date: number;
}

export interface RecurringBill {
  id?: number;
  name: string;
  amount: number;
  dayOfMonth: number;
  categoryId?: number;
  accountId?: number;
  cardId?: number;
  active: boolean;
}

export interface Settings {
  id?: number;
  userName: string;
  currency: string;
  theme: "dark" | "light";
  onboarded: boolean;
  notifications: boolean;
  rolloverEnabled: boolean;
  createdAt: number;
}

export interface MonthlySnapshot {
  id?: number;
  month: string; // YYYY-MM
  totalAllocated: number;
  totalSpent: number;
  netPosition: number;
  cardOutstanding: number;
  capturedAt: number;
}

class ZeroFlowDB extends Dexie {
  settings!: Table<Settings, number>;
  accounts!: Table<Account, number>;
  creditCards!: Table<CreditCard, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  reimbursements!: Table<Reimbursement, number>;
  recurringBills!: Table<RecurringBill, number>;
  monthlySnapshots!: Table<MonthlySnapshot, number>;

  constructor() {
    super("zeroflow");
    this.version(1).stores({
      settings: "++id",
      accounts: "++id, name, type",
      creditCards: "++id, name",
      categories: "++id, name",
      transactions: "++id, date, type, categoryId, accountId, cardId",
      reimbursements: "++id, date, resolved",
      recurringBills: "++id, dayOfMonth, active",
      monthlySnapshots: "++id, month",
    });
  }
}

export const db = new ZeroFlowDB();

export async function getSettings(): Promise<Settings | undefined> {
  return db.settings.toCollection().first();
}

export async function ensureSettings(): Promise<Settings> {
  const existing = await getSettings();
  if (existing) return existing;
  const id = await db.settings.add({
    userName: "Friend",
    currency: "₹",
    theme: "dark",
    onboarded: false,
    notifications: true,
    rolloverEnabled: true,
    createdAt: Date.now(),
  });
  return (await db.settings.get(id))!;
}

export async function resetAll() {
  await Promise.all([
    db.settings.clear(),
    db.accounts.clear(),
    db.creditCards.clear(),
    db.categories.clear(),
    db.transactions.clear(),
    db.reimbursements.clear(),
    db.recurringBills.clear(),
    db.monthlySnapshots.clear(),
  ]);
}

export async function exportBackup(): Promise<string> {
  const data = {
    version: 1,
    exportedAt: Date.now(),
    settings: await db.settings.toArray(),
    accounts: await db.accounts.toArray(),
    creditCards: await db.creditCards.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    reimbursements: await db.reimbursements.toArray(),
    recurringBills: await db.recurringBills.toArray(),
    monthlySnapshots: await db.monthlySnapshots.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importBackup(json: string) {
  const data = JSON.parse(json);
  await resetAll();
  await db.transaction(
    "rw",
    [db.settings, db.accounts, db.creditCards, db.categories, db.transactions, db.reimbursements, db.recurringBills, db.monthlySnapshots],
    async () => {
      if (data.settings?.length) await db.settings.bulkAdd(data.settings);
      if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
      if (data.creditCards?.length) await db.creditCards.bulkAdd(data.creditCards);
      if (data.categories?.length) await db.categories.bulkAdd(data.categories);
      if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
      if (data.reimbursements?.length) await db.reimbursements.bulkAdd(data.reimbursements);
      if (data.recurringBills?.length) await db.recurringBills.bulkAdd(data.recurringBills);
      if (data.monthlySnapshots?.length) await db.monthlySnapshots.bulkAdd(data.monthlySnapshots);
    }
  );
}
