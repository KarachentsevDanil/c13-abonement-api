import { describe, expect, it } from "vitest";
import { fineMinor } from "../../../src/loans/fines";

const now = new Date("2026-11-03T09:00:00Z");

describe("fineMinor", () => {
  it("no fine before due date", () => {
    expect(fineMinor({ dueAt: new Date("2026-11-10T00:00:00Z"), returnedAt: null }, now)).toBe(0);
  });

  it("5 UAH per business day for an unreturned loan", () => {
    // due пт 30.10, сьогодні вт 03.11: пн і вт — 2 робочі дні
    expect(fineMinor({ dueAt: new Date("2026-10-30T00:00:00Z"), returnedAt: null }, now)).toBe(1000);
  });

  it("counts up to the return date for a returned loan", () => {
    const loan = { dueAt: new Date("2026-10-12T00:00:00Z"), returnedAt: new Date("2026-10-15T00:00:00Z") };
    expect(fineMinor(loan, now)).toBe(1500);
  });
});
