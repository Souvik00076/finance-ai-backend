
import mongoose, { Document, model, Schema } from "mongoose";

export type User = {
  phone?: string;
  telegram_id?: string;
}

export interface IUser extends User, Document { }

const userSchema = new Schema<IUser>({
  phone: {
    type: String,
    unique: true
  },
  telegram_id: {
    type: String,
    unique: true
  }
},
  {
    timestamps: true
  }
)

export const User = model<IUser>('users', userSchema);


