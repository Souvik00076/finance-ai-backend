import { OperationPublisher } from "./broker.publisher.OperationPublisher";
import { EXCHANGES, PublisherConfig, ROUTING_KEYS } from "../@types/broker";

class AianalysisPublisher {
  private static instance: AianalysisPublisher | null = null;
  private static initializationPromise: Promise<AianalysisPublisher> | null = null;
  private publisher: OperationPublisher | null = null;

  private constructor() { }

  public static async getInstance(): Promise<AianalysisPublisher> {
    if (AianalysisPublisher.instance) {
      return AianalysisPublisher.instance;
    }
    if (AianalysisPublisher.initializationPromise) {
      return AianalysisPublisher.initializationPromise;
    }
    AianalysisPublisher.initializationPromise = (async () => {
      const instance = new AianalysisPublisher();
      await instance.initializePublisher();
      AianalysisPublisher.instance = instance;
      return instance;
    })();
    return AianalysisPublisher.initializationPromise;
  }
  private async initializePublisher(): Promise<void> {
    const config: PublisherConfig = {
      exchange: EXCHANGES.AI_ANALYSIS,
      exchangeType: 'topic',
      durable: true,
      name: "Ai analysis Publisher"
    }
    this.publisher = await new OperationPublisher(
      config
    ).initialize();
  }

  public getPublisher(): OperationPublisher {
    return this.publisher!;
  }
}


export const handleAiPublish = async (
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>
) => {
  const operationId = crypto.randomUUID();
  const routingKey = ROUTING_KEYS.AI_NEW_MESSAGE;
  const publisher = (await AianalysisPublisher.getInstance()).getPublisher();
  const response = await publisher.publish({
    type: routingKey,
    operationId,
    timestamp: Date.now(),
    data,
    metadata
  })
  return response;
}
