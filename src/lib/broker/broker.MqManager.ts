import type { AmqpConnectionManager } from "amqp-connection-manager";
import amqp from "amqp-connection-manager";
import { BrokerError } from "../error";


abstract class RabbitMqManager {
  private connection: AmqpConnectionManager | null = null;
  private connecting: Promise<any> | null = null;
  public constructor(url: string = process.env.RABBIT_MQ_URL!) {
    this.connection = amqp.connect([url])
  }
  public async connect() {
    try {
      if (this.connection?.isConnected()) {
        return { connection: this.connection }
      }
      if (this.connecting) {
        await this.connecting;
        this.connecting = null;
        return { connection: this.connection! }
      }
      this.connecting = this.connection!.connect();
      await this.connecting;
      this.connecting = null;
      return { connection: this.connection! }
    } catch (error) {
      throw new BrokerError(`${error}`)
    }
  }
  public async disconnect() {
    try {
      if (this.connection) {
        await this.connection.close();
      }
      this.connection = null;
      console.log("RabbitMQ disconnected");
    } catch (error) {
      throw new BrokerError(`${error}`)
    }
  }
  public getConnection(): AmqpConnectionManager {
    if (!this.connection?.isConnected()) throw new Error("TCP Not created");
    return this.connection;
  }
}

class ProducerRabbitMQManager extends RabbitMqManager {
  private static instance: ProducerRabbitMQManager;
  private constructor() {
    super();
  }
  public static getInstance(): ProducerRabbitMQManager {
    if (!ProducerRabbitMQManager.instance) {
      ProducerRabbitMQManager.instance = new ProducerRabbitMQManager();
    }
    return ProducerRabbitMQManager.instance;
  }
}


class ConsumerRabbitMQManager extends RabbitMqManager {
  private static instance: ConsumerRabbitMQManager;
  private constructor() {
    super();
  }
  public static getInstance(): ProducerRabbitMQManager {
    if (!ConsumerRabbitMQManager.instance) {
      ConsumerRabbitMQManager.instance = new ConsumerRabbitMQManager();
    }
    return ConsumerRabbitMQManager.instance;
  }
}

export const producerRabbitMQManager = ProducerRabbitMQManager.getInstance();
export const consumerRabbitMQManager = ConsumerRabbitMQManager.getInstance();
