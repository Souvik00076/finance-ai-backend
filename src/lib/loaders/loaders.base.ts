
export abstract class BaseLoader {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }
  protected getMessage() {
    return `Loader : ${this.name}`;
  }
  protected abstract load(): Promise<any> | any;
}
