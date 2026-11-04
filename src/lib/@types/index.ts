import { Type, type Static, TIntersect, TObject } from "@sinclair/typebox";

export interface ValidatorRequestReturn<T> {
  schema: TObject | TIntersect;
  verify: (data: T) => T;
}

export type Item = {
  name: string;
  price: string;
  currency: string;
}

// ───────────── LLM output (see src/lib/ai/prompt.ts) ─────────────

export const EXPENSE_CATEGORIES = [
  "food", "transport", "shopping", "entertainment", "health", "utilities", "education",
  "personal_care", "housing", "subscriptions", "travel", "gifts_donations", "financial",
  "pets", "childcare", "other",
] as const;

export const INCOME_CATEGORIES = [
  "salary", "freelance", "business", "investment", "interest", "rental", "gift", "refund", "other",
] as const;

const literals = <T extends readonly string[]>(values: T) =>
  Type.Union(values.map((v) => Type.Literal(v)));

export type ExpenseOutput = Static<typeof ExpenseOutput>;
export const ExpenseOutput = Type.Object({
  type: Type.Literal("expense"),
  title: Type.String({ minLength: 1 }),
  categories: Type.Array(literals(EXPENSE_CATEGORIES), { minItems: 1 }),
  items: Type.Array(
    Type.Object({
      name: Type.String({ minLength: 1 }),
      price: Type.String({ pattern: "^-?\\d+(\\.\\d+)?$" }),
      currency: Type.Literal("INR"),
    }),
    { minItems: 1 },
  ),
});

export type IncomeEntry = Static<typeof IncomeEntry>;
export const IncomeEntry = Type.Object({
  amount: Type.String({ pattern: "^\\d+(\\.\\d+)?$" }),
  currency: Type.Literal("INR"),
  source: Type.String({ minLength: 1 }),
  category: literals(INCOME_CATEGORIES),
  date: Type.Union([Type.String(), Type.Null()]), // checked/resolved in code (utils.date)
});

export type IncomeOutput = Static<typeof IncomeOutput>;
export const IncomeOutput = Type.Object({
  type: Type.Literal("income"),
  entries: Type.Array(IncomeEntry, { minItems: 1 }),
});

export type IrrelevantOutput = { type: "irrelevant" };

export type AiOutput = ExpenseOutput | IncomeOutput | IrrelevantOutput;
