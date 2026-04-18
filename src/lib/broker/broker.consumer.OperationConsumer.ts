import type { Channel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { consumerRabbitMQManager } from "./broker.MqManager";
import { Options, ConsumerInitializer, ExchangeBinding } from "../@types/broker";
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import { BrokerError } from "../error";


const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;

export class OperationConsumer {
  private channel: ChannelWrapper | null = null;
  private consumerName: string;
  private exchangeBindings: ExchangeBinding[];
  private queue: string;
  private options: Options;
  private prefetch: number;
  private durable: boolean;
  private connection: AmqpConnectionManager | null = null;

  // DLQ + Retry naming
  private dlxExchange: string;
  private dlqQueue: string;
  private dlqRoutingKey: string;
  private retryExchange: string;
  private retryQueue: string;
  private retryRoutingKey: string;

  constructor(initializerData: ConsumerInitializer) {
    const { queue, consumerName, durable = false, exchangeBindings, prefetch = 1, options = {} } = initializerData;
    this.queue = queue;
    this.consumerName = consumerName;
    this.durable = durable;
    this.options = options;
    this.prefetch = prefetch;
    this.exchangeBindings = exchangeBindings;

    // Derive names from queue name
    this.dlxExchange = `dlx.${queue}`;
    this.dlqQueue = `${queue}.dlq`;
    this.dlqRoutingKey = `${queue}.dead`;
    this.retryExchange = `retry.exchange.${queue}`;
    this.retryQueue = `retry.${queue}`;
    this.retryRoutingKey = `${queue}.retry`;
  }

  async initialize(): Promise<OperationConsumer> {
    const { connection } = await consumerRabbitMQManager.connect();
    this.channel = connection.createChannel({
      name: this.consumerName,
      setup: async (channel: Channel | ConfirmChannel) => {
        channel.prefetch(this.prefetch)
        //primary queue setup
        const response = await channel.assertQueue(this.queue, {
          durable: this.durable,
          arguments: {
            'x-dead-letter-exchange': this.dlxExchange,
            'x-dead-letter-routing-key': this.dlqRoutingKey
          }
        });

        for (const binding of this.exchangeBindings) {
          for (const key of binding.routingKeys) {
            await channel.bindQueue(response.queue, binding.exchange, key);
          }
        }

        // 1. DLQ setup
        await channel.assertExchange(this.dlxExchange, 'direct', { durable: true });
        await channel.assertQueue(this.dlqQueue, { durable: true });
        await channel.bindQueue(this.dlqQueue, this.dlxExchange, this.dlqRoutingKey);

        // 2. Retry queue setup (TTL → routes back to main queue)
        await channel.assertExchange(this.retryExchange, 'direct', { durable: true });
        await channel.assertQueue(this.retryQueue, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': '',              // default exchange
            'x-dead-letter-routing-key': this.queue,   // back to main queue
            'x-message-ttl': RETRY_DELAY_MS,
          },
        });

        await channel.bindQueue(this.retryQueue, this.retryExchange, this.retryRoutingKey);

      },
    });
    this.channel.waitForConnect().catch(error => {
      throw new BrokerError(`${this.consumerName} could not connect: ${error.message}`)
    });
    this.connection = connection;
    return this;
  }

  private getRetryCount(msg: any): number {
    return msg.properties?.headers?.['x-retry-count'] ?? 0;
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
              const retryCount = this.getRetryCount(msg);
              if (retryCount >= MAX_RETRIES) {
                this.channel!.nack(msg, false, false);
                console.warn(
                  `Message sent to DLQ after ${retryCount} retries [queue: ${this.queue}]`,
                );
              } else {
                this.channel!.ack(msg);
                this.channel!.publish(
                  this.retryExchange,
                  this.retryRoutingKey,
                  msg.content,
                  {
                    headers: {
                      ...msg.properties.headers,
                      'x-retry-count': retryCount + 1,
                    },
                    persistent: true,
                  },
                );
                console.warn(
                  `Retrying message (${retryCount + 1}/${MAX_RETRIES}) [queue: ${this.queue}]`,
                );
              }
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
