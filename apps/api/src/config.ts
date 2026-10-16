import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  METRICS_PORT: z.coerce.number().default(3001),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/tracker"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("development-only-change-me-32-characters"),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
export const config = schema.parse(process.env);
if (
  config.NODE_ENV === "production" &&
  config.SESSION_SECRET.startsWith("development-only")
)
  throw new Error("Задайте SESSION_SECRET");
