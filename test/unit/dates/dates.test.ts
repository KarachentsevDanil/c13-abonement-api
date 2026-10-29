import { describe, expect, it } from "vitest";
import { addDays, businessDaysBetween } from "../../../src/dates";

describe("dates", () => {
  it("addDays adds calendar days", () => {
    expect(addDays(new Date("2026-11-10T00:00:00Z"), 14)).toEqual(new Date("2026-11-24T00:00:00Z"));
  });

  it("businessDaysBetween skips weekends", () => {
    // пт 06.11 → пн 09.11: один робочий день
    expect(businessDaysBetween(new Date("2026-11-06T00:00:00Z"), new Date("2026-11-09T00:00:00Z"))).toBe(1);
  });

  it("businessDaysBetween is zero when the end is earlier", () => {
    expect(businessDaysBetween(new Date("2026-11-09T00:00:00Z"), new Date("2026-11-06T00:00:00Z"))).toBe(0);
  });
});
