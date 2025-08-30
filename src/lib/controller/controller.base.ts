
import type { NextFunction, Request, Response } from "express";
// Base interface for HTTP methods
type HttpHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;
export interface IGet {
  get: HttpHandler;
}
export interface IPost {
  post: HttpHandler;
}
export interface IPut {
  put: HttpHandler;
}
export interface IPatch {
  patch: HttpHandler;
}
export interface IDelete {
  delete: HttpHandler;
}
