import { Type, type Static } from "@sinclair/typebox";
import type { AmqpConnectionManager } from "amqp-connection-manager";
export interface RabbitMQConnection {
  connection: AmqpConnectionManager;
}

// interfaces.ts
export interface OperationMetadata {
  type: string;
  [key: string]: unknown;
}

export interface OperationData {
  type: string;
  operationId: string;
  timestamp: number;
  data: Record<string, unknown>;
  metadata: OperationMetadata;
}

export enum EXCHANGES {
  AI_ANALYSIS = 'AI_ANALYSIS'
}


export interface ExchangeBinding {
  exchange: EXCHANGES
  routingKeys: string[]
}

export type Options = {
  noAck?: boolean
  exclusive?: boolean
  consumerTag?: string
  arguments?: any
}
export interface ConsumerInitializer {
  queue: string
  consumerName: string
  durable?: boolean
  exchangeBindings: ExchangeBinding[]
  prefetch?: number
  options?: Options
}

export enum PUBLISHER_TYPE {
}

export enum ROUTING_KEYS {
  AI_NEW_MESSAGE = 'ai.message.added'
}

export enum QUEUE {
  AI_ANALYSIS_QUEUE = 'ai_analysis_queuev1'
}
export type ConsumerOptions = {
  noAck?: boolean;
  exclusive?: boolean;
  consumerTag?: string;
  arguments?: any;
};

export interface PublisherConfig {
  exchange: EXCHANGES;
  exchangeType: 'direct' | 'topic' | 'fanout';
  durable?: boolean;
  name: string;
}


export interface Operation {
  type: ROUTING_KEYS;
  operationId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  data: Record<string, unknown>;
}

export type BrokerContent = Static<typeof BrokerContent>;
export const BrokerContent = Type.Object({
  type: Type.String(),
  operationId: Type.String(),
  timestamp: Type.Number(),
});

export type ProviderContentDto = Static<typeof ProviderContentDto>;
export const ProviderContentDto = Type.Object({
  Body: Type.String(),
  From: Type.String(),
  origin: Type.String(),
  created_at: Type.Number()
})

export type AiContentDto = Static<typeof AiContentDto>;
export const AiContentDto = Type.Intersect([
  BrokerContent,
  Type.Object({
    data: ProviderContentDto
  })
])

