import { BaseRouter } from "./routes.base";
import { WebhookRouter } from "./routes.webhook";


export class MainRoute extends BaseRouter {
  constructor(path: string) {
    super(path);
  }

  protected initializeRoutes(): void {
    this.setChildren({
      router: new WebhookRouter("/hook")
    })
    this.registerChildren();
  }
}
