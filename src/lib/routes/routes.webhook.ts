import { WebhookController } from "../controller/controller.webhook";
import { BaseRouter } from "./routes.base";


export class WebhookRouter extends BaseRouter {
  constructor(path: string) {
    super(path, new WebhookController());
  }
  protected initializeRoutes(): void {
    const router = this.getRouter();
    const controller: WebhookController = this.controller;
    router.post("/", controller.post)
  }
}
