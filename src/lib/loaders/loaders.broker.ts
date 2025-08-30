import { aiAnalyzaerConsumer } from "../broker/broker.consumer.AiAnalyzer";
import { consumerRabbitMQManager, producerRabbitMQManager } from "../broker/broker.MqManager";
import { BaseLoader } from "./loaders.base";

export class BrokerLoader extends BaseLoader {
  private static instance: BrokerLoader;
  private constructor(name: string) {
    super(name);
  }

  public static async getInstance() {
    if (!BrokerLoader.instance) {
      BrokerLoader.instance = new BrokerLoader("BrokerLoader")
      await BrokerLoader.instance.load();
    }
    return BrokerLoader.instance;
  }
  protected async load() {
    await producerRabbitMQManager.connect();
    await consumerRabbitMQManager.connect();
    await aiAnalyzaerConsumer();
  }
}
