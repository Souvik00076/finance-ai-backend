import { ConsumeMessage } from "amqplib";
import mongoose from "mongoose";
import { AiContentDto, EXCHANGES, QUEUE, ROUTING_KEYS, ProviderContentDto, ConsumerInitializer } from "../@types/broker";
import { OperationConsumer } from "./broker.consumer.OperationConsumer";
import { Model } from "../ai/Model";
import { messageAnalysisprompt } from "../ai/prompt";
import { parseModelOutput } from "../ai/output";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ExpenseOutput, IncomeOutput } from "../@types";
import { validateRequest } from "../utils/utils.validateRequest";
import { istDateString, resolveEarnedAt } from "../utils/utils.date";
import { TUserData, UserData } from "../schemas/schema.UserData";
import { TUserIncome, UserIncome } from "../schemas/schema.UserIncome";
import { User } from "../schemas/user";
import { NonRetryableError } from "../error";

const validator = validateRequest<AiContentDto>(AiContentDto);

const isDuplicateKey = (err: any) => err?.code === 11000 || err?.writeErrors?.some?.((e: any) => e?.code === 11000);

const userFilter = (aiData: ProviderContentDto) =>
  aiData.origin === "telegram" ? { telegram_id: aiData.From } : { phone: aiData.From };

/**
 * Runs the inserts and the user total update in one transaction, so a retry can never
 * insert twice or double-increment. A duplicate key means an earlier attempt already committed.
 */
async function commitOnce(operationId: string, label: string, work: (session: mongoose.ClientSession) => Promise<void>) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => work(session));
  } catch (err) {
    if (isDuplicateKey(err)) {
      console.log(`[${operationId}] ${label} already saved by an earlier attempt, skipping`);
      return;
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

async function runModel(input_text: string, current_date: string): Promise<unknown> {
  const chain = messageAnalysisprompt
    .pipe(Model.getInstance().getChatInstance())
    .pipe(new JsonOutputParser());
  try {
    return await chain.invoke({ input_text, current_date });
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const message = String(err?.message ?? err);
    // Retrying cannot fix these; send them straight to the DLQ instead of burning tokens.
    if (status === 413 || /request too large/i.test(message)) {
      throw new NonRetryableError(`LLM request too large: ${message.slice(0, 300)}`);
    }
    if (err?.name === "OutputParserException" || err?.lc_error_code === "OUTPUT_PARSING_FAILURE") {
      throw new NonRetryableError(`LLM returned non-JSON output: ${message.slice(0, 300)}`);
    }
    throw err;
  }
}

async function saveExpense(result: ExpenseOutput, aiData: ProviderContentDto, operationId: string) {
  const doc: TUserData = {
    chat_id: aiData.From,
    categories: result.categories,
    items: result.items,
    source: aiData.origin,
    created_at_ms: aiData.created_at,
    operation_id: operationId,
  };
  const totalAmount = result.items.reduce((sum, item) => sum + parseFloat(item.price), 0);

  await commitOnce(operationId, "expense", async (session) => {
    await UserData.create([doc], { session });
    await User.updateOne(userFilter(aiData), { $inc: { total_spent: totalAmount } }, { session });
  });
  console.log(`[${operationId}] expense saved: ${result.items.length} item(s), total ${totalAmount}`);
}

async function saveIncome(result: IncomeOutput, aiData: ProviderContentDto, operationId: string) {
  const docs: TUserIncome[] = result.entries.map((entry, index) => {
    const { earnedAtMs, fromMessage } = resolveEarnedAt(entry.date, aiData.created_at);
    return {
      chat_id: aiData.From,
      channel: aiData.origin,
      amount: parseFloat(entry.amount),
      currency: entry.currency,
      source: entry.source,
      category: entry.category,
      earned_at_ms: earnedAtMs,
      date_from_message: fromMessage,
      created_at_ms: aiData.created_at,
      operation_id: operationId,
      entry_index: index,
    };
  });
  const totalAmount = docs.reduce((sum, d) => sum + d.amount, 0);

  await commitOnce(operationId, "income", async (session) => {
    await UserIncome.insertMany(docs, { session });
    await User.updateOne(userFilter(aiData), { $inc: { total_earned: totalAmount } }, { session });
  });
  console.log(`[${operationId}] income saved: ${docs.length} entr${docs.length === 1 ? "y" : "ies"}, total ${totalAmount}`);
}

async function handleAnalysis(content: ConsumeMessage) {
  const { operationId, data: aiData } = validator.verify(JSON.parse(content.content.toString()));

  // "Today" is the day the message was sent (IST), not when this attempt runs.
  const current_date = istDateString(aiData.created_at);
  const raw = await runModel(aiData.Body, current_date);
  console.log(`[${operationId}] model output:`, JSON.stringify(raw));

  const result = parseModelOutput(raw);
  switch (result.type) {
    case "irrelevant":
      return;
    case "expense":
      return saveExpense(result, aiData, operationId);
    case "income":
      return saveIncome(result, aiData, operationId);
  }
}

export async function aiAnalyzaerConsumer() {
  // Make sure the unique indexes used for idempotency exist before consuming.
  await Promise.all([UserData.init(), UserIncome.init()]);

  const initializer: ConsumerInitializer = {
    exchangeBindings: [
      {
        exchange: EXCHANGES.AI_ANALYSIS,
        routingKeys: [ROUTING_KEYS.AI_NEW_MESSAGE]
      }
    ],
    durable: true,
    consumerName: "Ai Analysis Consumer For Whatsapp inbound messages",
    queue: QUEUE.AI_ANALYSIS_QUEUE
  }
  const newTimesheetConsumer = await new OperationConsumer(
    initializer
  ).initialize();
  newTimesheetConsumer.startConsumer(handleAnalysis);
  console.log("AI Analysis Consumer started")
}
