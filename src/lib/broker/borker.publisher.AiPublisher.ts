import { OperationPublisher } from "./broker.publisher.OperationPublisher";
import { EXCHANGES, ROUTING_KEYS } from "../@types/broker";

const aiAnalysisPublisher = await new OperationPublisher(
  EXCHANGES.AI_ANALYSIS,
  "direct",
  true,
  "AI Analysis Publisher"
).initialize();

export const handleAiPublish = async (
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>
) => {
  const operationId = crypto.randomUUID();
  const routingKey = ROUTING_KEYS.AI_ANALYSIS;
  const response = await aiAnalysisPublisher.publish({
    type: routingKey,
    operationId,
    timestamp: Date.now(),
    data,
    metadata
  })
  return response;
}
