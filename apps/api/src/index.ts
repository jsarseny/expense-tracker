import mongoose from "mongoose";
import express from "express";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { UserModel, CategoryModel, TransactionModel } from "./models.js";
await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
const { app, registry, store } = createApp();
await Promise.all([
  store.collectionP,
  UserModel.init(),
  CategoryModel.init(),
  TransactionModel.init(),
]);
const server = app.listen(config.PORT, "0.0.0.0", () =>
  console.log(`API :${config.PORT}`),
);
const metricsApp = express();
metricsApp.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType).send(await registry.metrics());
});
const metrics = metricsApp.listen(config.METRICS_PORT, "0.0.0.0");
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  await Promise.all([
    new Promise<void>((r) => server.close(() => r())),
    new Promise<void>((r) => metrics.close(() => r())),
  ]);
  registry.clear();
  await store.close();
  await mongoose.disconnect();
  clearTimeout(timeout);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
