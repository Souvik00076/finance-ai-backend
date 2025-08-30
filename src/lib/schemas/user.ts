
import mongoose, { Document, model, Schema } from "mongoose";

export type User = {
  phone: string;
}

export interface IUser extends User, Document { }

const userSchema = new Schema<IUser>({
  phone: {
    type: String,
    required: true,
    unique: true
  }
},
  {
    timestamps: true
  }
)

export const User = model<IUser>('user', userSchema);


