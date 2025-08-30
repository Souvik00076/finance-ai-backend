import { CustomError } from "./error.CustomError";
export class NotFound extends CustomError {
  public statusCode = 404;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, NotFound.prototype);
  }
}
