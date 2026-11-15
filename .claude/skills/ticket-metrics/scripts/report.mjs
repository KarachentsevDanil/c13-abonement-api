#!/usr/bin/env node
// Звіт про тікет з локальних логів Claude Code.
//
//   node report.mjs LIB-311            markdown-звіт для терміналу
//   node report.mjs LIB-311 --json     ті самі числа в JSON
//   node report.mjs LIB-311 --dir <папка проєкту>
//
// Логи: <CLAUDE_CONFIG_DIR або ~/.claude>/projects/<шлях проєкту через дефіси>/<сесія>.jsonl
// і <сесія>/subagents/agent-*.jsonl. Тікет шукаємо в назві гілки (gitBranch) кожного запису.
// Фаза — attributionSkill відповіді моделі: скіл, активний під час запиту. Хід без скіла після
// запуску фази в тій самій сесії (відповідь на питання агента, «онови план») — уточнення цієї фази.
// Формат логів внутрішній і недокументований: він може змінитися з версією Claude Code.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_SKILL = "ticket-metrics";
const PHASE_ORDER = ["research", "tdd", "implement"];
const NO_PHASE = "поза фазами";
// Інструменти, на яких агент чекає людину: інтервал до їхнього результату — час людини.
const WAITS_FOR_HUMAN = new Set(["AskUserQuestion", "ExitPlanMode"]);

const args = process.argv.slice(2);
const ticket = args.find((a) => !a.startsWith("--"));
const asJson = args.includes("--json");
const dirArg = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : undefined;
if (!ticket || !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(ticket)) {
  console.error("Вкажи номер тікета, напр.: node report.mjs LIB-311");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const prices = JSON.parse(readFileSync(join(here, "..", "prices.json"), "utf8"));

function projectRoot() {
  if (dirArg) return dirArg;
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const root = projectRoot();
const logsDir = join(configDir, "projects", root.replace(/[^A-Za-z0-9]/g, "-"));
if (!existsSync(logsDir)) {
  console.error(`Логів для ${root} немає: ${logsDir}`);
  process.exit(1);
}

const branchRe = new RegExp(`(^|[^A-Za-z0-9])${ticket.replace("-", "-")}([^0-9]|$)`, "i");
const matches = (r) => typeof r.gitBranch === "string" && branchRe.test(r.gitBranch);

function readJsonl(file) {
  const out = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // незавершений рядок поточної сесії
    }
  }
  return out;
}

function priceFor(model) {
  if (!model) return undefined;
  const key = Object.keys(prices.models)
    .filter((k) => model === k || model.startsWith(`${k}-`) || model.startsWith(`${k}@`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? { key, ...prices.models[key] } : undefined;
}

function costOf(model, u) {
  const p = priceFor(model);
  if (!p) return undefined;
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - w1h);
  const input = u.input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const out = u.output_tokens ?? 0;
  let rate = p;
  if (p.over && input + read + w5m + w1h > p.over.promptTokens) rate = p.over;
  if (u.speed === "fast" && p.fast) {
    const k = p.fast.input / p.input;
    rate = { input: p.fast.input, output: p.fast.output, cacheWrite5m: rate.cacheWrite5m * k, cacheWrite1h: rate.cacheWrite1h * k, cacheRead: rate.cacheRead * k };
  }
  let usd = (input * rate.input + w5m * rate.cacheWrite5m + w1h * rate.cacheWrite1h + read * rate.cacheRead + out * rate.output) / 1e6;
  if (u.inference_geo === "us") usd *= prices.inferenceGeoUsMultiplier;
  return usd;
}

const shortModel = (m) => priceFor(m)?.name ?? m ?? "?";

function isHumanPrompt(r) {
  if (r._sub || r.type !== "user" || r.isMeta || r.isCompactSummary) return false;
  const c = r.message?.content;
  if (typeof c === "string") return true;
  return Array.isArray(c) && c.some((b) => b.type === "text") && !c.some((b) => b.type === "tool_result");
}

function toolUses(r) {
  const c = r.message?.content;
  return Array.isArray(c) ? c.filter((b) => b.type === "tool_use").map((b) => b.name) : [];
}

// Скіл, який людина набрала: `<command-name>/research</command-name>` або рядок `/implement LIB-311`
// (скіл з context: fork у -p).
function commandOf(r) {
  const c = r.message?.content;
  const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((b) => b.type === "text").map((b) => b.text).join("\n") : "";
  const m = text.match(/<command-name>\/?([^<\s]+)<\/command-name>/) || text.match(/^\s*\/([A-Za-z0-9_:-]+)/);
  return m?.[1];
}

const blank = (name) => ({ phase: name, models: new Set(), efforts: new Set(), requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUSD: 0, agentSeconds: 0, unpriced: 0 });
const phases = new Map();
const phase = (name) => {
  if (!phases.has(name)) phases.set(name, { ...blank(name), followUp: blank("↳ з них уточнення") });
  return phases.get(name);
};
const phaseOf = (r) => r._phase || r.attributionSkill || NO_PHASE;

// Claude Code ставить attributionSkill (і skill.name в OpenTelemetry) лише на хід, у якому скіл
// запустили. Відповідь людини на питання фази — вже новий хід без скіла. Такі відповіді моделі
// в основній сесії приписуємо останній фазі цієї сесії й позначаємо як уточнення, поки людина
// не запустить інший скіл. Після /ticket-metrics чи зміни гілки фази немає.
function markFollowUps(records, skills) {
  let current;
  let branch;
  for (const r of records) {
    if (typeof r.gitBranch === "string" && r.gitBranch !== branch) {
      branch = r.gitBranch;
      current = undefined;
    }
    if (isHumanPrompt(r)) {
      const cmd = commandOf(r);
      if (cmd === SELF_SKILL) current = undefined;
      else if (skills.has(cmd)) current = cmd;
    }
    if (r.type !== "assistant") continue;
    if (r.attributionSkill) current = r.attributionSkill === SELF_SKILL ? undefined : r.attributionSkill;
    else if (current) {
      r._phase = current;
      r._followUp = true;
    }
  }
}

const seenRequests = new Set();
const sessions = new Set();
const branches = new Set();
const unknownModels = new Set();
let subagents = 0;
let firstTs;
let lastTs;
let fastSeen = false;

function addUsage(r) {
  const u = r.message?.usage;
  if (!u) return;
  const id = r.requestId || r.message?.id;
  if (id) {
    if (seenRequests.has(id)) return;
    seenRequests.add(id);
  }
  const p = phase(phaseOf(r));
  const model = r.message.model;
  if (model === "<synthetic>") return;
  if (u.speed === "fast") fastSeen = true;
  const usd = costOf(model, u);
  if (usd === undefined) unknownModels.add(model);
  for (const t of r._followUp ? [p, p.followUp] : [p]) {
    t.models.add(shortModel(model));
    if (r.effort) t.efforts.add(r.effort);
    t.requests += 1;
    t.input += u.input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
    if (usd === undefined) t.unpriced += 1;
    else t.costUSD += usd;
  }
}

// Час агента: інтервали між сусідніми записами сесії разом із її субагентами, крім тих, що
// закінчуються запитом людини або починаються з виклику, на якому агент чекає людину
// (питання, схвалення плану). Субагенти в одній шкалі з сесією: паралельна робота не рахується двічі.
function addAgentTime(records) {
  const rs = records.filter((r) => r.timestamp && typeof r.gitBranch === "string" && ["user", "assistant", "system"].includes(r.type)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  // Фаза кожного запису: найближча відповідь моделі далі в тому самому ході, інакше попередня.
  const next = new Array(rs.length);
  let carry;
  for (let i = rs.length - 1; i >= 0; i--) {
    if (rs[i].type === "assistant") carry = rs[i];
    next[i] = carry;
    if (isHumanPrompt(rs[i])) carry = undefined;
  }
  let prev;
  for (let i = 1; i < rs.length; i++) {
    const a = rs[i - 1];
    const b = rs[i];
    if (a.type === "assistant") prev = a;
    if (isHumanPrompt(b)) {
      prev = undefined;
      continue;
    }
    // Старт субагента: інтервал до нього не його робота (мітка може бути раніше за запит людини).
    if (b._subStart) continue;
    if (!matches(b)) continue;
    if (a.type === "assistant" && toolUses(a).some((t) => WAITS_FOR_HUMAN.has(t))) continue;
    const dt = (Date.parse(b.timestamp) - Date.parse(a.timestamp)) / 1000;
    if (dt <= 0) continue;
    const owner = b.type === "assistant" ? b : (next[i] ?? prev);
    const p = phase(owner ? phaseOf(owner) : NO_PHASE);
    p.agentSeconds += dt;
    if (owner?._followUp) p.followUp.agentSeconds += dt;
  }
}

for (const entry of readdirSync(logsDir)) {
  if (!entry.endsWith(".jsonl")) continue;
  const records = readJsonl(join(logsDir, entry));
  // Субагенти сесії: <сесія>/subagents/agent-*.jsonl, у тому числі скіли з context: fork.
  const subFiles = [];
  const subDir = join(logsDir, entry.replace(/\.jsonl$/, ""), "subagents");
  if (existsSync(subDir) && statSync(subDir).isDirectory()) {
    for (const s of readdirSync(subDir)) if (s.endsWith(".jsonl")) subFiles.push(readJsonl(join(subDir, s)).map((r, i) => ({ ...r, _sub: true, _subStart: i === 0 })));
  }
  const mine = records.filter(matches);
  const subMine = subFiles.map((f) => f.filter(matches));
  if (mine.length === 0 && subMine.every((f) => f.length === 0)) continue;
  const skills = new Set(PHASE_ORDER);
  for (const r of [...records, ...subFiles.flat()]) if (r.attributionSkill) skills.add(r.attributionSkill);
  markFollowUps(records, skills);
  let used = false;
  for (const r of [...mine, ...subMine.flat()]) {
    branches.add(r.gitBranch);
    if (r.type === "assistant") {
      addUsage(r);
      if (phaseOf(r) !== SELF_SKILL) used = true;
    }
    const t = Date.parse(r.timestamp);
    if (!Number.isNaN(t)) {
      firstTs = firstTs === undefined || t < firstTs ? t : firstTs;
      lastTs = lastTs === undefined || t > lastTs ? t : lastTs;
    }
  }
  if (used) sessions.add(entry.replace(/\.jsonl$/, ""));
  subagents += subMine.filter((f) => f.some((r) => r.type === "assistant" && phaseOf(r) !== SELF_SKILL)).length;
  addAgentTime([...records, ...subFiles.flat()]);
}

phases.delete(SELF_SKILL);
const rows = [...phases.values()].sort((a, b) => rank(a.phase) - rank(b.phase) || a.phase.localeCompare(b.phase));
function rank(name) {
  const i = PHASE_ORDER.indexOf(name);
  if (i >= 0) return i;
  return name === NO_PHASE ? 100 : 50;
}
const total = rows.reduce(
  (t, r) => {
    for (const k of ["requests", "input", "output", "cacheRead", "cacheWrite", "costUSD", "agentSeconds", "unpriced"]) t[k] += r[k];
    r.models.forEach((m) => t.models.add(m));
    r.efforts.forEach((e) => t.efforts.add(e));
    return t;
  },
  { phase: "разом", models: new Set(), efforts: new Set(), requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUSD: 0, agentSeconds: 0, unpriced: 0 },
);

if (rows.length === 0) {
  console.log(`Тікет ${ticket}: у логах ${logsDir} немає гілки з цим номером.`);
  process.exit(0);
}

if (asJson) {
  const plain = (r) => ({ ...r, models: [...r.models], efforts: [...r.efforts], costUSD: Number(r.costUSD.toFixed(4)), agentSeconds: Math.round(r.agentSeconds), ...(r.followUp && { followUp: plain(r.followUp) }) });
  console.log(JSON.stringify({ ticket, logsDir, branches: [...branches], sessions: [...sessions], subagents, from: firstTs && new Date(firstTs).toISOString(), to: lastTs && new Date(lastTs).toISOString(), phases: rows.map(plain), total: plain(total), unknownModels: [...unknownModels], fastMode: fastSeen, prices: { source: prices.source, checked: prices.checked } }, null, 2));
  process.exit(0);
}

const tok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const usd = (n) => `$${n.toFixed(2)}`;
const dur = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return m > 0 ? `${m} хв ${String(sec).padStart(2, "0")} с` : `${sec} с`;
};
const plural = (n, one, few, many) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} ${one}`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
};
const home = homedir();
const tilde = (p) => (p.startsWith(home) ? `~${p.slice(home.length)}` : p);
const day = (t) => new Date(t).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });

const lines = [];
lines.push(`**Тікет ${ticket}** · гілка ${[...branches].join(", ")} · ${plural(sessions.size, "сесія", "сесії", "сесій")} · ${plural(subagents, "субагент", "субагенти", "субагентів")}`);
lines.push("");
lines.push("| фаза | модель | effort | токени вх / вих / кеш | вартість* | час агента** |");
lines.push("|---|---|---|---|---:|---:|");
const row = (r, bold) => {
  const b = (s) => (bold ? `**${s}**` : s);
  const cost = usd(r.costUSD) + (r.unpriced ? " +?" : "");
  return `| ${b(r.phase)} | ${[...r.models].join(", ")} | ${[...r.efforts].join(", ")} | ${tok(r.input)} / ${tok(r.output)} / ${tok(r.cacheRead + r.cacheWrite)} | ${b(cost)} | ${b(dur(r.agentSeconds))} |`;
};
for (const r of rows) {
  lines.push(row(r, false));
  if (r.followUp.requests > 0) lines.push(row(r.followUp, false));
}
lines.push(row(total, true));
lines.push("");
if (rows.some((r) => r.followUp.requests > 0)) {
  lines.push("↳ Уточнення — ходи без скіла після запуску фази в тій самій сесії, напр. відповідь на питання агента. Уже входять у рядок фази. Claude Code ставить skill.name лише на хід зі скілом, тож в OpenTelemetry вони «поза фазами».");
}
lines.push(`\\* Оцінка за цінами API (${prices.source.replace("https://", "")}, перевірено ${prices.checked.split("-").reverse().join(".")}), не рахунок.${fastSeen ? " Є запити у fast mode: пораховано за його цінами." : ""}${unknownModels.size ? ` Немає ціни для: ${[...unknownModels].join(", ")}.` : ""}`);
lines.push("\\*\\* Наближення з міток часу в логах: робота агента без очікування на людину.");
lines.push(`Логи: ${tilde(logsDir)}, ${day(firstTs)}–${day(lastTs)}. Формат логів внутрішній, може змінитися. Запуски /${SELF_SKILL} не враховано.`);
console.log(lines.join("\n"));
