import { EXCHANGES, PublisherConfig, type Operation } from "../@types/broker";
import { producerRabbitMQManager } from "./broker.MqManager";
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import type { ConfirmChannel, Channel } from "amqplib";

export class OperationPublisher {
  private channel: ChannelWrapper | null = null;
  private connection: AmqpConnectionManager | null = null;
  private exchange: EXCHANGES;
  private exchangeType: "direct" | "topic" | "fanout";
  private durable: boolean;
  private name: string;

  constructor(
    config: PublisherConfig
  ) {
    const { exchange, exchangeType, durable = false, name } = config;
    this.exchange = exchange;
    this.exchangeType = exchangeType;
    this.durable = durable;
    this.name = name;
  }

  async initialize(): Promise<OperationPublisher> {
    const data = await producerRabbitMQManager.connect();
    this.connection = data.connection;
    this.channel = this.connection.createChannel({
      name: this.name,
      setup: async (channel: ConfirmChannel | Channel) => {
        await channel.assertExchange(this.exchange, this.exchangeType, {
          durable: this.durable,
        });
      },
    });
    await this.channel.waitForConnect();
    console.log(`${this.name} Connected`);
    return this;
  }

  async publish(operation: Operation): Promise<boolean> {
    if (!this.channel) {
      throw new Error("Channel not initialized");
    }
    try {
      const content = Buffer.from(JSON.stringify(operation), "utf-8");
      const published = this.channel.publish(
        this.exchange,
        operation.type,
        content,
        {
          persistent: true,
          messageId: operation.operationId,
          timestamp: operation.timestamp,
          headers: {
            operationType: operation.type,
            ...operation.metadata,
          },
        },
      );
      if (!published) {
        throw new Error("Failed to publish message");
      }
      return published;
    } catch (error) {
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
