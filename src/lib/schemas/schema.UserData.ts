import { Document, model, Schema } from "mongoose";
import { Item } from "../@types";

export type UserData = {
  WaId: string;
  categories: string[];
  items: Item[];
  phone: string;
}

export interface IUserData extends UserData, Document { }

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
  WaId: {
    type: String,
    required: true,
  },
  categories: {
    type: [String],
    default: []
  },
  items: {
    type: [itemSchema],
    default: []
  },
  phone: {
    type: String,
    required: true,
  }
}, {
  timestamps: true
});

export const UserData = model<IUserData>('user_data', userDataSchema);
