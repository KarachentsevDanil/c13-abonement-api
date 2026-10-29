import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import type { DueLoan } from "../store/loans.repo";

const template = Handlebars.compile(
  readFileSync(new URL("./templates/due-reminder.hbs", import.meta.url), "utf8"),
);

export interface ReminderEmail {
  to: string;
  subject: string;
  text: string;
}

// Дата в листі — за Києвом, як на стійці.
const dateFormat = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "long" });

export function dueReminder(loan: DueLoan): ReminderEmail {
  return {
    to: loan.readerEmail,
    subject: `Нагадування: повернення книги #${loan.bookId}`,
    text: template({
      readerName: loan.readerName,
      bookId: loan.bookId,
      dueDate: dateFormat.format(loan.dueAt),
    }),
  };
}
