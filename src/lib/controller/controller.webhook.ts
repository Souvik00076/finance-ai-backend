import { NextFunction, Request, Response } from "express";
import { IPost } from "./controller.base";
import { handleAiPublish } from "../broker/borker.publisher.AiPublisher";
import { sendTelegramMessage } from "../utils/utils.telegram";


export class WebhookController implements IPost {
  constructor() {
    this.post = this.post.bind(this);
  }

  async post(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const channel_type = req.channel_type;
      const aiData = {
        Body: '',
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

        const msg: string = data.message.text;
        aiData.Body = msg;
        aiData.From = String(data.message.from.id);
        console.log(msg);
        if (msg.toLowerCase() === 'spendly') {
          console.log(msg)
          await sendTelegramMessage(data.message.from.id, `Welcome to Spendly! Your chat id is ${aiData.From}.`);
          res.json({ message: "Ok" });
          return;
        }
      }
      if (aiData.Body.length <= 3000) {
        await handleAiPublish(aiData);
      }
      res.json({ message: "OK" })
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
}
