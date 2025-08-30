import type { Channel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { consumerRabbitMQManager } from "./broker.MqManager";
import { EXCHANGES, ROUTING_KEYS } from "../@types/broker";
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import { BrokerError } from "../error";
type ConsumerCallback = (msg: ConsumeMessage | null) => Promise<void>;
type Options = {
  noAck?: boolean;
  exclusive?: boolean;
  consumerTag?: string;
  arguments?: any;
};

export class OperationConsumer {
  private channel: ChannelWrapper | null = null;
  private consumerName: string;
  private exchange: EXCHANGES;
  private routingKey: ROUTING_KEYS;
  private queue: string;
  private options: Options;
  private prefetch: number;
  private durable: boolean;
  private connection: AmqpConnectionManager | null = null;

  constructor(
    queue: string,
    consumerName: string,
    durable: boolean,
    exchange: EXCHANGES,
    routingKey: ROUTING_KEYS,
    options: Options,
    prefetch: number = 100
  ) {
    this.queue = queue;
    this.consumerName = consumerName;
    this.durable = durable;
    this.exchange = exchange;
    this.routingKey = routingKey;
    this.options = options;
    this.prefetch = prefetch;
  }

  async initialize(): Promise<OperationConsumer> {
    const { connection } = await consumerRabbitMQManager.connect();
    this.channel = connection.createChannel({
      name: this.consumerName,
      setup: async (channel: Channel | ConfirmChannel) => {
        channel.prefetch(this.prefetch)
        const response = await channel.assertQueue(this.queue, {
          durable: this.durable,
        });
        await channel.bindQueue(response.queue, this.exchange, this.routingKey);
      },
    });
    this.channel.waitForConnect().catch(error => {
      throw new BrokerError(`${this.consumerName} could not connect: ${error.message}`)
    });
    this.connection = connection;
    return this;
  }

  async startConsumer(callback: (...rest: any) => Promise<any>): Promise<void> {
    if (!this.channel) {
      throw new Error("Channel not initialized. Call initialize() first.");
    }
    try {
      const consumeOptions = {
        noAck: false,
        exclusive: false,
        ...this.options,
      };
      const { consumerTag } = await this.channel.consume(
        this.queue,
        async (msg) => {
          try {
            await callback(msg);
            if (msg && !consumeOptions.noAck) {
              this.channel!.ack(msg);
            }
          } catch (error) {
            console.error(
              `Error processing message from queue ${this.queue}:`,
              error,
            );
            if (msg && !consumeOptions.noAck) {
              this.channel!.nack(msg, false, true);
            }
          }
        },
        consumeOptions,
      );
      console.log(`Consumer started for queue:${this.queue}`);
    } catch (error) {
      throw error;
    }
  }
}
