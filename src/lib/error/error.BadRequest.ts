import { CustomError } from "./error.CustomError";
export class BadRequest extends CustomError {
  public statusCode = 400;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, BadRequest.prototype);
  }
}
