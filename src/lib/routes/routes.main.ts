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
    this.getRouter().get('/test', (req, res) => {

      res.json({
        status: 201,
        data: "UP annd running"
      })
    })
    this.registerChildren();
  }
}
