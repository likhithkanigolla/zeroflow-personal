import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureSettings } from "@/lib/db";

export function useSettings() {
  useEffect(() => {
    ensureSettings();
  }, []);
  return useLiveQuery(() => db.settings.toCollection().first(), []);
}

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray(), []) ?? [];
}
export function useCards() {
  return useLiveQuery(() => db.creditCards.toArray(), []) ?? [];
}
export function useCategories() {
  return useLiveQuery(() => db.categories.toArray(), []) ?? [];
}
export function useTransactions(limit = 200) {
  return useLiveQuery(() => db.transactions.orderBy("date").reverse().limit(limit).toArray(), [limit]) ?? [];
}
export function useReimbursements() {
  return useLiveQuery(() => db.reimbursements.orderBy("date").reverse().toArray(), []) ?? [];
}
export function useRecurringBills() {
  return useLiveQuery(() => db.recurringBills.toArray(), []) ?? [];
}
export function useSavingsGoals() {
  return useLiveQuery(() => db.savingsGoals.orderBy("createdAt").reverse().toArray(), []) ?? [];
}
