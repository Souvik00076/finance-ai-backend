import { CustomError } from "./error.CustomError";

/**
 * Thrown by a consumer handler when retrying cannot help (e.g. the LLM request is too
 * large for the provider's limit, or the model output failed validation).
 * OperationConsumer sends these straight to the DLQ instead of the retry queue.
 */
export class NonRetryableError extends CustomError {
  public statusCode = 422;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, NonRetryableError.prototype);
  }
}
