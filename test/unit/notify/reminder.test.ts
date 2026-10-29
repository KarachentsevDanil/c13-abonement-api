import { describe, expect, it } from "vitest";
import { dueReminder } from "../../../src/notify/reminder";

// Golden-файл листа погоджує контент-команда: __snapshots__/reminder.test.ts.snap
describe("due reminder email", () => {
  it("matches the approved text", () => {
    const email = dueReminder({
      loanId: 5,
      bookId: 105,
      dueAt: new Date("2026-11-04T00:00:00Z"),
      readerName: "Тарас Мельник",
      readerEmail: "reader4@example.com",
    });
    expect(email).toMatchSnapshot();
  });
});
