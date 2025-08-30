import { NextFunction, Request, Response } from "express";
import { IPost } from "./controller.base";
import { handleAiPublish } from "../broker/borker.publisher.AiPublisher";


export class WebhookController implements IPost {
  constructor() {
    this.post = this.post.bind(this);
  }
  async post(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      await handleAiPublish(data);
      res.sendStatus(201);
    } catch (error) {
      next(error);
    }
  }
}
