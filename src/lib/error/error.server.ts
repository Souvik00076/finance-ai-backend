
import { CustomError } from "./error.CustomError";
export class ServerError extends CustomError {
  public statusCode = 500;
  constructor() {
    super("Internal Server Error");
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
