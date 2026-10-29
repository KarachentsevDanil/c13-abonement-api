import { businessDaysBetween } from "../dates";
import type { Loan } from "../store/schema";

// Штраф за прострочку: 5 грн за кожен робочий день після due_at.
export const FINE_PER_BUSINESS_DAY_MINOR = 500;

export function fineMinor(loan: Pick<Loan, "dueAt" | "returnedAt">, now: Date): number {
  const end = loan.returnedAt ?? now;
  return businessDaysBetween(loan.dueAt, end) * FINE_PER_BUSINESS_DAY_MINOR;
}
