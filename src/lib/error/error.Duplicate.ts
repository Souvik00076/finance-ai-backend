import { CustomError } from "./error.CustomError";
export class Duplicate extends CustomError {
  public statusCode = 409;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, Duplicate.prototype);
  }
}
