import { type Express } from "express";
import express from "express";
import { BaseLoader } from "./loaders.base";
import { CatchAllError } from "../error/error.catchall";
import { MainRoute } from "../routes/routes.main";



export class ExpressLoader extends BaseLoader {
  private static instance: ExpressLoader;
  private app: Express = express();
  private constructor(name: string) {
    super(name);
  }
  public static async getInstance() {
    if (!ExpressLoader.instance) {
      ExpressLoader.instance = new ExpressLoader("ExpressLoader");
      await ExpressLoader.instance.load();
    }
    return this.instance.app;
  }
  protected async load() {
    this.app.use(express.urlencoded({
      extended: true,
      verify: (req, res, buf) => {
        (req as any).rawBody = buf;
      }
    }));

    this.app.use(express.json({
      limit: "1mb",
    }));
    this.app.use('/api/v1', new MainRoute('/').getRouter());
    this.app.use(new CatchAllError().execute);
    this.app.listen(8000, () => {
      console.log(`Express loaded at port : ${process.env.PORT!}`);
    });
  }
}

