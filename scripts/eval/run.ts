/**
 * Prompt evaluation runner for src/lib/ai/prompt.ts against Groq.
 *
 * Usage (from finance-ai-backend/):
 *   GROQ_API_KEY=... GROQ_MODEL=openai/gpt-oss-20b bun scripts/eval/run.ts [options]
 *
 * Options:
 *   --smoke              run only cases marked smoke
 *   --only E01,I30       run only these case ids
 *   --tag income.dates   run only cases whose tag starts with this
 *   --limit N            stop after N cases
 *   --resume <dir>       continue a previous run (skips cases already in results.jsonl)
 *   --out <dir>          output dir (default scripts/eval/output/<timestamp>)
 *
 * Rate limiting (Groq free tier): reads x-ratelimit-* headers and waits until enough
 * tokens are available before each call (TPM bucket), keeps a minimum gap between requests,
 * honours retry-after on 429, and stops cleanly (resumable) on a daily-limit 429.
 */
import { mkdirSync, existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { messageAnalysisprompt } from "../../src/lib/ai/prompt";
import { CASES, DEFAULT_DATE, type TestCase, type Expect } from "./cases";

// ───────────────────────── config ─────────────────────────
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const URL = "https://api.groq.com/openai/v1/chat/completions";
const MIN_GAP_MS = 2500;       // never more than ~24 RPM
const SAFETY_TOKENS = 300;     // headroom on top of the estimated reservation per call
const MAX_RETRIES = 6;

if (!API_KEY) {
  console.error("GROQ_API_KEY is not set");
  process.exit(1);
}

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(name);

const EXPENSE_CATEGORIES = new Set([
  "food", "transport", "shopping", "entertainment", "health", "utilities", "education",
  "personal_care", "housing", "subscriptions", "travel", "gifts_donations", "financial",
  "pets", "childcare", "other",
]);
const INCOME_CATEGORIES = new Set([
  "salary", "freelance", "business", "investment", "interest", "rental", "gift", "refund", "other",
]);

// ───────────────────────── throttle ─────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parses Groq durations like "50.032s", "1m26.4s", "120ms", "1h2m3s". */
function parseDuration(s: string | null): number {
  if (!s) return 0;
  let ms = 0;
  const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = parseFloat(m[1]);
    ms += m[2] === "h" ? v * 3_600_000 : m[2] === "m" ? v * 60_000 : m[2] === "s" ? v * 1000 : v;
  }
  return ms;
}

class Throttle {
  limitTokens = 8000;
  remainingTokens: number | null = null;
  remainingRequests: number | null = null;
  snapshotAt = 0;
  lastRequestAt = 0;
  estimate = 7600; // Groq reserves ~prompt+1.2k per call; refined from 429 "Requested N"

  async waitTurn() {
    const gap = Date.now() - this.lastRequestAt;
    if (gap < MIN_GAP_MS) await sleep(MIN_GAP_MS - gap);

    if (this.remainingRequests !== null && this.remainingRequests <= 1) {
      throw new DailyLimitError("Requests-per-day budget exhausted (x-ratelimit-remaining-requests)");
    }
    if (this.remainingTokens !== null) {
      const ratePerMs = this.limitTokens / 60_000; // TPM bucket refills continuously
      const elapsed = Date.now() - this.snapshotAt;
      const available = Math.min(this.limitTokens, this.remainingTokens + elapsed * ratePerMs);
      const need = Math.min(this.limitTokens, this.estimate + SAFETY_TOKENS);
      if (available < need) {
        const waitMs = Math.ceil((need - available) / ratePerMs) + 1000;
        log(`  ⏳ token bucket ~${Math.floor(available)}/${this.limitTokens}, need ~${need} → waiting ${(waitMs / 1000).toFixed(1)}s`);
        await sleep(waitMs);
      }
    }
    this.lastRequestAt = Date.now();
  }

  update(h: Headers, totalTokens?: number) {
    const lt = h.get("x-ratelimit-limit-tokens");
    const rt = h.get("x-ratelimit-remaining-tokens");
    const rr = h.get("x-ratelimit-remaining-requests");
    if (lt) this.limitTokens = parseInt(lt, 10);
    if (rt) { this.remainingTokens = parseInt(rt, 10); this.snapshotAt = Date.now(); }
    if (rr) this.remainingRequests = parseInt(rr, 10);
    if (totalTokens) this.estimate = Math.max(this.estimate, totalTokens);
  }

  /** After a 429 the bucket state is unknown; assume empty. */
  drain() { this.remainingTokens = 0; this.snapshotAt = Date.now(); }
}

class DailyLimitError extends Error {}

// ───────────────────────── API call ─────────────────────────
type CallResult = {
  raw: string;
  reasoning?: string;
  usage?: any;
  latencyMs: number;
  attempts: number;
};

async function callGroq(prompt: string, throttle: Throttle): Promise<CallResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await throttle.waitTurn();
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        // Mirrors production: single user message, no temperature/max_tokens override.
        body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] }),
      });
    } catch (e) {
      log(`  ⚠ network error (attempt ${attempt}): ${e}`);
      await sleep(5000 * attempt);
      continue;
    }
    const latencyMs = Date.now() - t0;
    const body: any = await res.json().catch(() => ({}));
    throttle.update(res.headers, body?.usage?.total_tokens);

    if (res.status === 429) {
      const msg: string = body?.error?.message || "";
      if (/per day|TPD|RPD/i.test(msg)) throw new DailyLimitError(msg);
      if (/request too large/i.test(msg)) throw new Error(`Request can never fit in TPM limit: ${msg.slice(0, 300)}`);
      // Groq says e.g. "Limit 8000, Used 4473, Requested 7604" — Requested is what it reserves per call
      // (prompt + completion reserve), so learn it and resync the bucket from Used.
      const used = msg.match(/Used (\d+)/)?.[1];
      const requested = msg.match(/Requested (\d+)/)?.[1];
      if (requested) throttle.estimate = Math.max(throttle.estimate, parseInt(requested, 10));
      log(`  ⚠ 429 rate limited (attempt ${attempt}): ${msg.slice(0, 200)}`);
      if (used) {
        throttle.remainingTokens = throttle.limitTokens - parseInt(used, 10);
        throttle.snapshotAt = Date.now();
      } else {
        const retryAfter = parseFloat(res.headers.get("retry-after") || "") * 1000 ||
          parseDuration(res.headers.get("x-ratelimit-reset-tokens")) || 30_000;
        throttle.drain();
        await sleep(retryAfter + 1000);
      }
      continue;
    }
    if (res.status >= 500) {
      log(`  ⚠ ${res.status} server error (attempt ${attempt})`);
      await sleep(5000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body?.error || body)}`);

    const msg = body.choices?.[0]?.message ?? {};
    return { raw: msg.content ?? "", reasoning: msg.reasoning, usage: body.usage, latencyMs, attempts: attempt };
  }
  throw new Error(`Gave up after ${MAX_RETRIES} attempts`);
}

// ───────────────────────── evaluation ─────────────────────────
type Check = { name: string; severity: "hard" | "soft"; pass: boolean; detail?: string };

const NUM_RE = /^-?\d+(\.\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const approx = (a: number, b: number) => Math.abs(a - b) < 0.011;

function isRealDate(s: string) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseOutput(raw: string): { strict: boolean; value: any | null; error?: string } {
  try {
    return { strict: true, value: JSON.parse(raw.trim()) };
  } catch {}
  // Lenient: what JsonOutputParser in production would roughly tolerate
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return { strict: false, value: JSON.parse(stripped.slice(start, end + 1)) };
    } catch (e) {
      return { strict: false, value: null, error: String(e) };
    }
  }
  return { strict: false, value: null, error: "no JSON object found" };
}

function keysExactly(obj: any, keys: string[]) {
  const actual = Object.keys(obj).sort();
  const want = [...keys].sort();
  return { pass: JSON.stringify(actual) === JSON.stringify(want), detail: `keys=${actual.join(",")}` };
}

function formatChecks(v: any, currentDate: string): Check[] {
  const c: Check[] = [];
  const add = (name: string, pass: boolean, detail?: string) => c.push({ name, severity: "hard", pass, detail });

  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    add("format.object", false, "output is not a JSON object");
    return c;
  }
  const t = v.type;
  add("format.type", ["expense", "income", "irrelevant"].includes(t), `type=${JSON.stringify(t)}`);

  if (t === "irrelevant") {
    const k = keysExactly(v, ["type"]);
    add("format.irrelevant.keys", k.pass, k.detail);
  }

  if (t === "expense") {
    const k = keysExactly(v, ["type", "title", "categories", "items"]);
    add("format.expense.keys", k.pass, k.detail);
    add("format.expense.title", typeof v.title === "string" && v.title.length > 0);
    const cats = Array.isArray(v.categories) ? v.categories : null;
    add("format.expense.categories", !!cats && cats.length > 0, `categories=${JSON.stringify(v.categories)}`);
    const bad = (cats || []).filter((x: any) => !EXPENSE_CATEGORIES.has(x));
    add("format.expense.categories.allowed", bad.length === 0, bad.length ? `invalid=${bad.join(",")}` : undefined);
    const items = Array.isArray(v.items) ? v.items : null;
    add("format.expense.items.nonEmpty", !!items && items.length > 0);
    (items || []).forEach((it: any, i: number) => {
      const ik = keysExactly(it ?? {}, ["name", "price", "currency"]);
      add(`format.expense.items[${i}].keys`, ik.pass, ik.detail);
      add(`format.expense.items[${i}].price`, typeof it?.price === "string" && NUM_RE.test(it.price),
        `price=${JSON.stringify(it?.price)}`);
      add(`format.expense.items[${i}].currency`, it?.currency === "INR", `currency=${JSON.stringify(it?.currency)}`);
    });
  }

  if (t === "income") {
    const k = keysExactly(v, ["type", "entries"]);
    add("format.income.keys", k.pass, k.detail);
    const entries = Array.isArray(v.entries) ? v.entries : null;
    add("format.income.entries.nonEmpty", !!entries && entries.length > 0);
    (entries || []).forEach((e: any, i: number) => {
      const ek = keysExactly(e ?? {}, ["amount", "currency", "source", "category", "date"]);
      add(`format.income.entries[${i}].keys`, ek.pass, ek.detail);
      add(`format.income.entries[${i}].amount`,
        typeof e?.amount === "string" && /^\d+(\.\d+)?$/.test(e.amount) && parseFloat(e.amount) > 0,
        `amount=${JSON.stringify(e?.amount)}`);
      add(`format.income.entries[${i}].currency`, e?.currency === "INR", `currency=${JSON.stringify(e?.currency)}`);
      add(`format.income.entries[${i}].source`, typeof e?.source === "string" && e.source.length > 0);
      add(`format.income.entries[${i}].category`, INCOME_CATEGORIES.has(e?.category), `category=${JSON.stringify(e?.category)}`);
      const d = e?.date;
      const dateOk = d === null || (typeof d === "string" && isRealDate(d));
      add(`format.income.entries[${i}].date`, dateOk, `date=${JSON.stringify(d)}`);
      if (typeof d === "string" && dateOk) {
        add(`format.income.entries[${i}].date.notFuture`, d <= currentDate, `date=${d} current=${currentDate}`);
      }
    });
  }
  return c;
}

function expectationChecks(v: any, exp: Expect): Check[] {
  const c: Check[] = [];
  const add = (name: string, severity: "hard" | "soft", pass: boolean, detail?: string) =>
    c.push({ name, severity, pass, detail });

  add("expect.type", "hard", v?.type === exp.type, `got=${v?.type} want=${exp.type}`);
  if (v?.type !== exp.type) return c;

  if (exp.type === "expense") {
    const items: any[] = Array.isArray(v.items) ? v.items : [];
    const prices = items.map((i) => parseFloat(i?.price));
    const total = prices.reduce((s, p) => s + (isNaN(p) ? 0 : p), 0);
    add("expect.expense.total", "hard", approx(total, exp.total), `got=${total} want=${exp.total}`);
    if (exp.itemCount !== undefined)
      add("expect.expense.itemCount", "soft", items.length === exp.itemCount, `got=${items.length} want=${exp.itemCount}`);
    const cats: string[] = Array.isArray(v.categories) ? v.categories : [];
    if (exp.categoriesInclude) {
      const missing = exp.categoriesInclude.filter((x) => !cats.includes(x));
      add("expect.expense.categoriesInclude", "soft", missing.length === 0,
        `got=${cats.join(",")} missing=${missing.join(",")}`);
    }
    if (exp.categoriesAnyOf)
      add("expect.expense.categoriesAnyOf", "soft", exp.categoriesAnyOf.some((x) => cats.includes(x)),
        `got=${cats.join(",")} anyOf=${exp.categoriesAnyOf.join(",")}`);
    for (const ei of exp.items ?? []) {
      const found = items.some((i) =>
        approx(parseFloat(i?.price), ei.price) &&
        (!ei.nameIncludes || String(i?.name).toLowerCase().includes(ei.nameIncludes.toLowerCase())));
      add(`expect.expense.item(${ei.nameIncludes ?? ""}=${ei.price})`, "soft", found);
    }
  }

  if (exp.type === "income") {
    const entries: any[] = Array.isArray(v.entries) ? v.entries : [];
    if (exp.entryCount !== undefined)
      add("expect.income.entryCount", "hard", entries.length === exp.entryCount, `got=${entries.length} want=${exp.entryCount}`);
    const used = new Set<number>();
    for (const ee of exp.entries) {
      const idx = entries.findIndex((e, i) => !used.has(i) && approx(parseFloat(e?.amount), ee.amount));
      add(`expect.income.amount(${ee.amount})`, "hard", idx >= 0,
        idx < 0 ? `amounts=${entries.map((e) => e?.amount).join(",")}` : undefined);
      if (idx < 0) continue;
      used.add(idx);
      const e = entries[idx];
      if (ee.category !== undefined)
        add(`expect.income[${ee.amount}].category`, "soft", e.category === ee.category, `got=${e.category} want=${ee.category}`);
      const accepted = ee.acceptDates ?? (ee.date !== undefined ? [ee.date] : undefined);
      if (accepted)
        add(`expect.income[${ee.amount}].date`, "hard", accepted.includes(e.date ?? null),
          `got=${JSON.stringify(e.date)} want=${accepted.map((d) => JSON.stringify(d)).join("|")}`);
      if (ee.sourceIncludes)
        add(`expect.income[${ee.amount}].source`, "soft",
          String(e.source).toLowerCase().includes(ee.sourceIncludes.toLowerCase()),
          `got=${JSON.stringify(e.source)} want~${ee.sourceIncludes}`);
    }
  }
  return c;
}

type Status = "PASS" | "WARN" | "FAIL" | "ERROR";
type Result = {
  id: string; tag: string; input: string; currentDate: string; note?: string;
  expected: Expect; status: Status; strictJson: boolean;
  raw?: string; parsed?: any; reasoning?: string; checks: Check[];
  usage?: any; latencyMs?: number; attempts?: number; error?: string; at: string;
};

function grade(checks: Check[], strictJson: boolean): Status {
  if (!strictJson || checks.some((c) => c.severity === "hard" && !c.pass)) return "FAIL";
  if (checks.some((c) => !c.pass)) return "WARN";
  return "PASS";
}

// ───────────────────────── reporting ─────────────────────────
let LOG_FILE = "";
function log(s: string) {
  console.log(s);
  if (LOG_FILE) appendFileSync(LOG_FILE, s + "\n");
}

function writeReport(dir: string, results: Result[], stoppedReason?: string) {
  const by = (s: Status) => results.filter((r) => r.status === s).length;
  const tags = [...new Set(results.map((r) => r.tag))].sort();
  const tokens = results.reduce((s, r) => s + (r.usage?.total_tokens ?? 0), 0);
  const lat = results.filter((r) => r.latencyMs).map((r) => r.latencyMs!).sort((a, b) => a - b);
  const p = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0);
  const strictFails = results.filter((r) => r.status !== "ERROR" && !r.strictJson).length;

  const summary = {
    model: MODEL, generatedAt: new Date().toISOString(), total: results.length,
    pass: by("PASS"), warn: by("WARN"), fail: by("FAIL"), error: by("ERROR"),
    strictJsonFailures: strictFails, totalTokens: tokens,
    latencyMs: { p50: p(0.5), p90: p(0.9), max: lat[lat.length - 1] ?? 0 },
    stoppedReason: stoppedReason ?? null,
    byTag: Object.fromEntries(tags.map((t) => {
      const rs = results.filter((r) => r.tag === t);
      return [t, { total: rs.length, pass: rs.filter((r) => r.status === "PASS").length,
        warn: rs.filter((r) => r.status === "WARN").length, fail: rs.filter((r) => r.status === "FAIL").length,
        error: rs.filter((r) => r.status === "ERROR").length }];
    })),
  };
  writeFileSync(join(dir, "summary.json"), JSON.stringify(summary, null, 2));

  const md: string[] = [];
  md.push(`# Prompt eval — ${MODEL}`, "", `Generated: ${summary.generatedAt}`, "");
  if (stoppedReason) md.push(`> **Run stopped early:** ${stoppedReason}. Resume with \`--resume ${dir}\`.`, "");
  md.push(`| Total | ✅ Pass | ⚠️ Warn | ❌ Fail | 💥 Error | Non-strict JSON | Tokens | p50 / p90 latency |`);
  md.push(`|---|---|---|---|---|---|---|---|`);
  md.push(`| ${summary.total} | ${summary.pass} | ${summary.warn} | ${summary.fail} | ${summary.error} | ${strictFails} | ${tokens} | ${p(0.5)}ms / ${p(0.9)}ms |`, "");
  md.push(`## By tag`, "", `| Tag | Total | Pass | Warn | Fail | Error |`, `|---|---|---|---|---|---|`);
  for (const [t, s] of Object.entries(summary.byTag) as any)
    md.push(`| ${t} | ${s.total} | ${s.pass} | ${s.warn} | ${s.fail} | ${s.error} |`);
  md.push("");

  const problems = results.filter((r) => r.status !== "PASS");
  if (problems.length) {
    md.push(`## Failures & warnings`, "");
    for (const r of problems) {
      md.push(`### ${r.status} — ${r.id} (${r.tag})`, "");
      md.push("Input:", "```", r.input, "```");
      if (r.currentDate !== DEFAULT_DATE) md.push(`Current date: \`${r.currentDate}\``);
      if (r.note) md.push(`Note: ${r.note}`);
      if (r.error) md.push(`Error: \`${r.error}\``);
      if (!r.strictJson && r.status !== "ERROR") md.push(`**Output was not strict raw JSON.**`);
      for (const c of r.checks.filter((c) => !c.pass))
        md.push(`- ${c.severity === "hard" ? "❌" : "⚠️"} \`${c.name}\`${c.detail ? ` — ${c.detail}` : ""}`);
      if (r.raw !== undefined) md.push("", "Raw output:", "```json", r.raw, "```");
      md.push("");
    }
  }
  md.push(`## All results`, "", `| ID | Tag | Status | Input |`, `|---|---|---|---|`);
  for (const r of results)
    md.push(`| ${r.id} | ${r.tag} | ${r.status} | ${r.input.replace(/\n/g, " ⏎ ").replace(/\|/g, "\\|").slice(0, 80)} |`);
  writeFileSync(join(dir, "report.md"), md.join("\n") + "\n");
  return summary;
}

// ───────────────────────── main ─────────────────────────
async function main() {
  const resumeDir = arg("--resume");
  const dir = resumeDir || arg("--out") ||
    join(import.meta.dir, "output", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  LOG_FILE = join(dir, "run.log");
  const resultsFile = join(dir, "results.jsonl");

  const previous: Result[] = existsSync(resultsFile)
    ? readFileSync(resultsFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  // Keep only the latest non-ERROR result per id; ERROR cases get retried on resume.
  const done = new Map<string, Result>();
  for (const r of previous) if (r.status !== "ERROR") done.set(r.id, r);

  let cases: TestCase[] = CASES;
  if (flag("--smoke")) cases = cases.filter((c) => c.smoke);
  const only = arg("--only");
  if (only) { const ids = new Set(only.split(",")); cases = cases.filter((c) => ids.has(c.id)); }
  const tag = arg("--tag");
  if (tag) cases = cases.filter((c) => c.tag.startsWith(tag));
  const limit = arg("--limit");
  const todo = cases.filter((c) => !done.has(c.id)).slice(0, limit ? parseInt(limit, 10) : undefined);

  log(`Model: ${MODEL}`);
  log(`Output: ${dir}`);
  log(`Cases: ${cases.length} selected, ${cases.length - todo.length} already done, ${todo.length} to run`);
  log(`Free tier is ~8000 TPM and each call is ~6.5k tokens → expect ~1 call/minute (~${todo.length} min).`);

  const throttle = new Throttle();
  const fresh: Result[] = [];
  let stoppedReason: string | undefined;

  for (const [n, tc] of todo.entries()) {
    const currentDate = tc.currentDate ?? DEFAULT_DATE;
    log(`[${n + 1}/${todo.length}] ${tc.id} (${tc.tag}) ${JSON.stringify(tc.input.slice(0, 60))}`);
    const base = { id: tc.id, tag: tc.tag, input: tc.input, currentDate, note: tc.note, expected: tc.expect,
      at: new Date().toISOString() };
    let result: Result;
    try {
      const prompt = await messageAnalysisprompt.format({ current_date: currentDate, input_text: tc.input });
      const call = await callGroq(prompt, throttle);
      const parsed = parseOutput(call.raw);
      const checks: Check[] = [
        { name: "format.strictJson", severity: "hard", pass: parsed.strict,
          detail: parsed.strict ? undefined : parsed.value ? "needed lenient parsing (fences/extra text)" : parsed.error },
      ];
      if (parsed.value !== null) {
        checks.push(...formatChecks(parsed.value, currentDate));
        checks.push(...expectationChecks(parsed.value, tc.expect));
      }
      result = { ...base, status: grade(checks, parsed.strict), strictJson: parsed.strict, raw: call.raw,
        parsed: parsed.value, reasoning: call.reasoning, checks, usage: call.usage,
        latencyMs: call.latencyMs, attempts: call.attempts };
    } catch (e) {
      if (e instanceof DailyLimitError) {
        stoppedReason = `daily rate limit hit: ${e.message.slice(0, 200)}`;
        log(`  🛑 ${stoppedReason}`);
        break;
      }
      result = { ...base, status: "ERROR", strictJson: false, checks: [], error: String(e) };
    }
    appendFileSync(resultsFile, JSON.stringify(result) + "\n");
    fresh.push(result);
    const failed = result.checks.filter((c) => !c.pass).map((c) => c.name);
    log(`  → ${result.status}${result.error ? ` ${result.error}` : ""}${failed.length ? ` [${failed.join(", ")}]` : ""}` +
      (result.usage ? ` (${result.usage.total_tokens} tok, ${result.latencyMs}ms)` : ""));
  }

  const all = [...done.values(), ...fresh].sort((a, b) => a.id.localeCompare(b.id));
  const s = writeReport(dir, all, stoppedReason);
  log("");
  log(`Done: ${s.pass} pass, ${s.warn} warn, ${s.fail} fail, ${s.error} error (of ${s.total})`);
  log(`Report: ${join(dir, "report.md")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
