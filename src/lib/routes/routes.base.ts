
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

type RouterChild = {
  router: BaseRouter;
  middlewares?: ((
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<any> | void)[];
};

export abstract class BaseRouter {
  private router: Router;
  private children: RouterChild[] = [];
  private path: string;
  protected controller: any;

  constructor(path: string, controller?: any) {
    this.router = Router({ mergeParams: true });
    this.path = path;
    this.controller = controller;
    console.log(`${this.path}router Initialized`);
    this.initializeRoutes();
  }
  protected abstract initializeRoutes(): void;
  public getRouter(): Router {
    return this.router;
  }
  public getPath(): string {
    return this.path;
  }
  protected setChildren(child: RouterChild) {
    this.children.push(child);
  }
  protected registerChildren() {
    this.children.forEach((child) => {
      let middlewares = child.middlewares || [];
      this.router.use(
        child.router.getPath(),
        ...middlewares,
        child.router.getRouter(),
      );
    });
  }
}
