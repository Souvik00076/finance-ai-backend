import mongoose, { Document, model, Schema } from "mongoose";
import { Item } from "../@types";

export type TUserData = {
  chat_id?: string;
  categories: string[];
  items: Item[];
  source: string;
  created_at_ms: number;
  operation_id?: string;
}

export interface IUserData extends TUserData, Document { }

const itemSchema = new Schema<Item>({
  name: {
    type: String,
    required: true
  },
  price: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    required: true
  }
}, { _id: false });

const userDataSchema = new Schema<IUserData>({
  chat_id: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    required: true
  },
  created_at_ms: {
    type: Number,
    required: true,
    default: () => Date.now()
  },
  categories: {
  type: [String],
  default: []
},
  items: {
  type: [itemSchema],
  default: []
},
  // Broker operationId: makes retries idempotent. Sparse because older docs don't have it.
  operation_id: {
    type: String,
    unique: true,
    sparse: true,
  }
}, {
  timestamps: true
});

export const UserData = mongoose.model<IUserData>('user_data', userDataSchema);
