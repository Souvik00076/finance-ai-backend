import { TIntersect, TObject } from "@sinclair/typebox";

export interface ValidatorRequestReturn<T> {
  schema: TObject | TIntersect;
  verify: (data: T) => T;
}

export type Item = {
  name: string;
  price: string;
  currency: string;
}

export type AiContent = {
  title?: String;
  categories?: string[];
  items?: Item[];
  type?: "irrelevant"
}
