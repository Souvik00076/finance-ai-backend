import type { NextFunction, Request, Response } from "express";
export abstract class BaseError {
  public execute = async (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    this.handle(req, res, next, error);
  };
  protected abstract handle(
    req: Request,
    res: Response,
    next: NextFunction,
    error: any
  ): Promise<void>;
}
