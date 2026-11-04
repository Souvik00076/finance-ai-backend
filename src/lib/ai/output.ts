import { TypeCompiler } from "@sinclair/typebox/compiler";
import {
  AiOutput,
  EXPENSE_CATEGORIES,
  ExpenseOutput,
  INCOME_CATEGORIES,
  IncomeOutput,
} from "../@types";
import { NonRetryableError } from "../error";

const expenseCheck = TypeCompiler.Compile(ExpenseOutput);
const incomeCheck = TypeCompiler.Compile(IncomeOutput);

const EXPENSE_SET = new Set<string>(EXPENSE_CATEGORIES);
const INCOME_SET = new Set<string>(INCOME_CATEGORIES);

const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 1,250 / 1250 / " 1250 " → "1250". Leaves anything non-numeric for the validator to reject. */
const numStr = (v: unknown) => (typeof v === "number" ? String(v) : String(v ?? "").replace(/,/g, "").trim());

/** Currency missing → INR; anything else is kept so validation rejects it. */
const currency = (v: unknown) => (v === undefined || v === null || v === "" ? "INR" : v);

function validationError(kind: string, check: typeof expenseCheck | typeof incomeCheck, value: unknown) {
  const errors = [...check.Errors(value)].slice(0, 5).map((e) => `${e.path} ${e.message}`);
  return new NonRetryableError(`Invalid ${kind} output from model: ${errors.join("; ")}`);
}

/**
 * Normalizes harmless deviations in the model's JSON (numbers instead of strings, missing title,
 * unknown categories → "other", ...) and then validates it strictly. Throws NonRetryableError when
 * the output is unusable, so the message goes to the DLQ instead of burning retries/tokens.
 */
export function parseModelOutput(raw: unknown): AiOutput {
  if (!isObject(raw)) throw new NonRetryableError(`Model output is not a JSON object: ${JSON.stringify(raw)}`);

  // Old prompt shape had no "type" on expenses.
  const type = raw.type ?? (Array.isArray(raw.items) ? "expense" : undefined);

  if (type === "irrelevant") return { type: "irrelevant" };

  if (type === "expense") {
    const categories = [
      ...new Set(
        (Array.isArray(raw.categories) ? raw.categories : []).map((c: unknown) =>
          EXPENSE_SET.has(String(c)) ? String(c) : "other",
        ),
      ),
    ];
    const candidate = {
      type: "expense",
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Receipt",
      categories: categories.length ? categories : ["other"],
      items: (Array.isArray(raw.items) ? raw.items : []).map((it: any) => ({
        name: String(it?.name ?? "").trim() || "Item",
        price: numStr(it?.price),
        currency: currency(it?.currency),
      })),
    };
    if (!expenseCheck.Check(candidate)) throw validationError("expense", expenseCheck, candidate);
    return candidate;
  }

  if (type === "income") {
    const entries = (Array.isArray(raw.entries) ? raw.entries : [])
      .map((e: any) => ({
        amount: numStr(e?.amount),
        currency: currency(e?.currency),
        source: String(e?.source ?? "").trim() || "Unknown",
        category: INCOME_SET.has(String(e?.category)) ? String(e?.category) : "other",
        date: typeof e?.date === "string" && e.date.trim() ? e.date.trim() : null,
      }))
      // A zero income carries no information.
      .filter((e: { amount: string }) => !(parseFloat(e.amount) === 0));
    if (entries.length === 0) return { type: "irrelevant" };

    const candidate = { type: "income", entries };
    if (!incomeCheck.Check(candidate)) throw validationError("income", incomeCheck, candidate);
    return candidate;
  }

  throw new NonRetryableError(`Unknown output type from model: ${JSON.stringify(raw).slice(0, 300)}`);
}
