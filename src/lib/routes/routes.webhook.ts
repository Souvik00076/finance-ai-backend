import { WebhookController } from "../controller/controller.webhook";
import { Forbidden } from "../error";
import { BaseRouter } from "./routes.base";
import { createHmac } from 'crypto'

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      channel_type: 'whatsapp' | 'telegram'
    }
  }
}
export class WebhookRouter extends BaseRouter {
  constructor(path: string) {
    super(path, new WebhookController());
  }
  protected initializeRoutes(): void {
    const router = this.getRouter();
    const controller: WebhookController = this.controller;

    router.post("/hookdeck", (req, res, next) => {
      const hmacHeader = req.get('x-hookdeck-signature');
      const hash = createHmac("sha256", process.env.HD_SIG!)
        .update(req.rawBody!)
        .digest("base64");
      req.channel_type = 'whatsapp'
      if (hash === hmacHeader) {
        return next();
      }
      throw new Forbidden('Unauthorized')
    }, controller.post)

    router.post("/hookdeck/telegram", (req, res, next) => {
      req.channel_type = 'telegram'
      return next();
    }, controller.post);
  }
}
