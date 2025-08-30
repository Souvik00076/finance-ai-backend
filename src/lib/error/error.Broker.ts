
import { CustomError } from "./error.CustomError";
export class BrokerError extends CustomError {
  public statusCode = 504;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, BrokerError.prototype);
  }
}
