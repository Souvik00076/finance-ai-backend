
import mongoose, { Document, Schema } from "mongoose";

export type TUser = {
  email: string;
  full_name?: string;
  picture?: string;
  provider: string;
  google_uid: string;
  email_verified: boolean;
  is_active: boolean;
  is_superuser: boolean;
  phone?: string;
  telegram_id?: string;
  is_phone_linked: boolean;
  is_telegram_linked: boolean;
  total_spent: number;
}

export interface IUser extends TUser, Document { }

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true
  },
  full_name: {
    type: String,
    default: null
  },
  picture: {
    type: String,
    default: null
  },
  provider: {
    type: String,
    required: true,
    default: "email"
  },
  google_uid: {
    type: String,
    required: true,
    unique: true
  },
  email_verified: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_superuser: {
    type: Boolean,
    default: false
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
  telegram_id: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
  is_phone_linked: {
    type: Boolean,
    default: false
  },
  is_telegram_linked: {
    type: Boolean,
    default: false
  },
  total_spent: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export const User = mongoose.model<IUser>('users', userSchema);

