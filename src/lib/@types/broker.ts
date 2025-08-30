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

export enum PUBLISHER_TYPE {
}

export enum ROUTING_KEYS {
  AI_ANALYSIS = 'ai_analysis'
}

export enum QUEUE {
  AI_ANALYSIS_QUEUE = 'ai_analysis_queuev1'
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

export type WhatsappContentDto = Static<typeof WhatsappContentDto>;
export const WhatsappContentDto = Type.Object({
  Body: Type.String(),
  WaId: Type.String(),
  From: Type.String()
})

export type AiContentDto = Static<typeof AiContentDto>;
export const AiContentDto = Type.Intersect([
  BrokerContent,
  Type.Object({
    data: WhatsappContentDto
  })
])

