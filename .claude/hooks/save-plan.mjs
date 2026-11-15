// PostToolUse на ExitPlanMode: схвалений план → docs/<тікет>/plan.md
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const plan = input.tool_response?.plan ?? "";
const ticket = plan.split("\n")[0].match(/[A-Z][A-Z0-9]*-\d+/)?.[0];

if (!ticket) {
  console.error("План не збережено: у першому рядку плану немає номера тікету.");
  process.exit(2); // exit 2 у PostToolUse показує stderr агентові
}

const dir = join(process.env.CLAUDE_PROJECT_DIR ?? input.cwd, "docs", ticket);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "plan.md"), plan);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: `Схвалений план збережено в docs/${ticket}/plan.md. Тестів і коду не пиши: наступний крок — /tdd ${ticket}, його запускає розробник.`,
  },
}));
