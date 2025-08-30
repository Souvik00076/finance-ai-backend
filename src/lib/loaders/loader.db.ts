import { BaseLoader } from "./loaders.base";
import mongoose, { Connection } from 'mongoose'
export class MongoDBLoader extends BaseLoader {
  private static instance: MongoDBLoader | null = null;
  private connection: Connection | null = null;
  private isConnected: boolean = false;
  private connectionString: string | null = null;
  private constructor() {
    super('MongoDB');
    this.connectionString = process.env.MONGO_URI!;
  }

  public static async getInstance(): Promise<MongoDBLoader> {
    if (!MongoDBLoader.instance) {
      MongoDBLoader.instance = new MongoDBLoader();
      await MongoDBLoader.instance.load();
    }
    return MongoDBLoader.instance;
  }

  protected async load(): Promise<Connection> {
    if (this.isConnected && this.connection) {
      console.log(this.getMessage() + ' - Using existing connection');
      return this.connection;
    }

    try {
      console.log(this.getMessage() + ' - Initializing connection...');
      await mongoose.connect(this.connectionString!, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      });
      this.connection = mongoose.connection;
      this.isConnected = true;
      console.log(this.getMessage() + ' - Connected successfully');
      return this.connection;
    } catch (error) {
      console.error(this.getMessage() + ' - Connection failed:', error);
      throw error;
    }
  }
}
