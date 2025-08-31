import { MongoDBLoader } from "./src/lib/loaders/loader.db";
import { BrokerLoader } from "./src/lib/loaders/loaders.broker";
import { ExpressLoader } from "./src/lib/loaders/loaders.express";



await MongoDBLoader.getInstance();
await ExpressLoader.getInstance();
await BrokerLoader.getInstance();

