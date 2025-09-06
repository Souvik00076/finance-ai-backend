import { MongoDBLoader } from "./src/lib/loaders/loader.db";
import { BrokerLoader } from "./src/lib/loaders/loaders.broker";
import { ExpressLoader } from "./src/lib/loaders/loaders.express";

console.log("APP Initialization Started")
await MongoDBLoader.getInstance();
await ExpressLoader.getInstance();
await BrokerLoader.getInstance();
console.log("App Initialization Completed")

