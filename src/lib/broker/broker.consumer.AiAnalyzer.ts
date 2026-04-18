import { ConsumeMessage } from "amqplib";
import { AiContentDto, EXCHANGES, QUEUE, ROUTING_KEYS, ProviderContentDto, ConsumerInitializer } from "../@types/broker";
import { OperationConsumer } from "./broker.consumer.OperationConsumer";
import { Model } from "../ai/Model";
import { messageAnalysisprompt } from "../ai/prompt";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { AiContent } from "../@types";
import { validateRequest } from "../utils/utils.validateRequest";
import { TUserData, UserData } from "../schemas/schema.UserData";
import { User } from "../schemas/user";
import { BadRequest } from "../error";

const validator = validateRequest<AiContentDto>(AiContentDto);
async function handleAnalysis(content: ConsumeMessage) {
  const { operationId, data: aiData } = validator.verify(JSON.parse(content.content.toString()));
  const model = Model.getInstance().getChatInstance();
  const chain = messageAnalysisprompt
    .pipe(model)
    .pipe(new JsonOutputParser<AiContent>());

  const modelResult = await chain.invoke({ input_text: aiData.Body });
  console.log(modelResult);
  if (modelResult.type === 'irrelevant') {
    return;
  }
  if (modelResult.items && modelResult.items.length === 0) {
    return;
  }
  const userData: TUserData[] = [{
    chat_id: aiData.From,
    categories: modelResult.categories!,
    items: modelResult.items! || [],
    source: aiData.origin,
    created_at_ms: aiData.created_at
  }]
  await UserData.insertMany(userData)

  const totalAmount = modelResult.items!.reduce((sum, item) => sum + parseFloat(item.price), 0);

  const filter = aiData.origin === 'telegram'
    ? { telegram_id: aiData.From }
    : { phone: aiData.From };

  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { total_spent: totalAmount } },
    { new: true }
  );

  if (user) {
    console.log(`Updated total_spent for user ${user._id} by ${totalAmount}`);
  }

  console.log("Message loaded in db")
}
export async function aiAnalyzaerConsumer() {
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


