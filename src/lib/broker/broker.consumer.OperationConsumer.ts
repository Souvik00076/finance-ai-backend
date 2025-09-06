import type { Channel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { consumerRabbitMQManager } from "./broker.MqManager";
import { ConsumerConfig, ConsumerExchange, EXCHANGES, ROUTING_KEYS } from "../@types/broker";
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
  private exchanges: ConsumerExchange[];
  private queue: string;
  private options: Options;
  private prefetch: number;
  private durable: boolean;
  private connection: AmqpConnectionManager | null = null;

  constructor(config: ConsumerConfig) {
    const { queue, consumerName, durable = false, options = {}, prefetch = 10, exchanges } = config;
    this.queue = queue;
    this.consumerName = consumerName;
    this.durable = durable;
    this.exchanges = exchanges;
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
          durable: this.durable
        });
        for (const exchange of this.exchanges) {
          for (const routingKey of exchange.routingKeys) {
            await channel.bindQueue(response.queue, exchange.exchange, routingKey);
          }
        }
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
