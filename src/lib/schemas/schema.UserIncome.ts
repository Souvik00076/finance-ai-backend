import mongoose, { Document, Schema } from "mongoose";

export type TUserIncome = {
  chat_id: string;
  channel: string;            // whatsapp | telegram (what user_datas calls "source")
  amount: number;
  currency: string;
  source: string;             // who paid / where it came from, e.g. "Acme Corp"
  category: string;
  earned_at_ms: number;       // when the money was earned (from the message, or message time)
  date_from_message: boolean; // false = no usable date in the message, earned_at_ms = message time
  created_at_ms: number;      // when the message arrived
  operation_id: string;       // broker operationId
  entry_index: number;        // position within the message's entries
};

export interface IUserIncome extends TUserIncome, Document { }

const userIncomeSchema = new Schema<IUserIncome>({
  chat_id: { type: String, required: true },
  channel: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: "INR" },
  source: { type: String, required: true, default: "Unknown" },
  category: { type: String, required: true, default: "other" },
  earned_at_ms: { type: Number, required: true },
  date_from_message: { type: Boolean, required: true, default: false },
  created_at_ms: { type: Number, required: true, default: () => Date.now() },
  operation_id: { type: String, required: true },
  entry_index: { type: Number, required: true },
}, {
  timestamps: true,
});

// Idempotent retries: one document per (message, entry).
userIncomeSchema.index({ operation_id: 1, entry_index: 1 }, { unique: true });
// Analytics queries: per user, by time.
userIncomeSchema.index({ chat_id: 1, earned_at_ms: -1 });

export const UserIncome = mongoose.model<IUserIncome>("user_income", userIncomeSchema, "user_incomes");
