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
      const channel_type = req.channel_type;
      const aiData = {
        Body: null,
        From: '',
        created_at: Date.now(),
        origin: channel_type
      }
      if (channel_type === 'whatsapp') {
        aiData.Body = data.Body;
        aiData.From = data.From;
      }
      if (channel_type === 'telegram') {
        if (!data.message.text) {
          res.json({ message: "Ok" })
          return
        }

        aiData.Body = data.message.text;
        aiData.From = String(data.message.from.id);
      }
      await handleAiPublish(aiData);
      res.json({ message: "OK" })
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
}
