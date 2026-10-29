import { addDays as addCalendarDays, differenceInBusinessDays } from "date-fns";

export function addDays(t: Date, days: number): Date {
  return addCalendarDays(t, days);
}

// Робочі дні між двома моментами (без субот і неділь), від'ємні — нуль.
export function businessDaysBetween(from: Date, to: Date): number {
  return Math.max(0, differenceInBusinessDays(to, from));
}
