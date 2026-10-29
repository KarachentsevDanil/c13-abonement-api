// src/loans/adminRenew.ts (2021 рік, до появи clock і src/dates)
// Продовження бібліотекарем на стійці. Політика мережі: від сьогодні,
// незалежно від поточної dueAt, — читач приносить книгу фізично.
import type { LoanDeps } from "./deps";
import { NotFoundError } from "./errors";

const RENEWAL_DAYS = 14;

export async function adminRenew({ loans }: LoanDeps, loanId: number): Promise<Date> {
  const newDue = addDays(new Date(), RENEWAL_DAYS);
  const loan = await loans.get(loanId);
  if (!loan || loan.returnedAt) throw new NotFoundError();
  await loans.update(loanId, { dueAt: newDue, renewals: loan.renewals + 1 });
  return newDue;
}

function addDays(t: Date, days: number): Date {
  return new Date(t.getTime() + days * 24 * 60 * 60 * 1000);
}
