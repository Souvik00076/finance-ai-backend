import { CustomError } from "./error.CustomError";
export class Forbidden extends CustomError {
  public statusCode = 403;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, Forbidden.prototype);
  }
}
