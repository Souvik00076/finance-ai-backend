import { ConsumeMessage } from "amqplib";
import { AiContentDto, EXCHANGES, QUEUE, ROUTING_KEYS, WhatsappContentDto } from "../@types/broker";
import { OperationConsumer } from "./broker.consumer.OperationConsumer";
import { Model } from "../ai/Model";
import { messageAnalysisprompt } from "../ai/prompt";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { AiContent } from "../@types";
import { validateRequest } from "../utils/utils.validateRequest";
import { UserData } from "../schemas/schema.UserData";

const validator = validateRequest<AiContentDto>(AiContentDto);
async function handleAnalysis(content: ConsumeMessage) {
  const { operationId, data } = validator.verify(JSON.parse(content.content.toString()));
  const model = Model.getInstance().getChatInstance();
  const chain =
    messageAnalysisprompt
      .pipe(model)
      .pipe(new JsonOutputParser<AiContent>());
  const modelResult = await chain.invoke({ input_text: data.Body });
  if (modelResult.type === 'irrelevant') {
    console.log("wrong type")
    return;
  }
  const phoneNumber = data.From.split(':')[1]
  const userData: UserData = {
    WaId: data.WaId,
    categories: modelResult.categories!,
    items: modelResult.items!,
    phone: phoneNumber
  }
  await UserData.insertOne(userData);
  console.log(userData);
  console.log("inserted")
}
export async function aiAnalyzaerConsumer() {
  const newTimesheetConsumer = await new OperationConsumer(
    QUEUE.AI_ANALYSIS_QUEUE,
    "Ai Analysis Consumer",
    false,
    EXCHANGES.AI_ANALYSIS,
    ROUTING_KEYS.AI_ANALYSIS,
    {}
  ).initialize();
  newTimesheetConsumer.startConsumer(handleAnalysis);
  console.log("AI Analysis Consumer started")
}
