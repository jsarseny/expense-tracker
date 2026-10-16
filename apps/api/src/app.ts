import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from "prom-client";
import { z } from "zod";
import {
  credentialsSchema,
  categorySchema,
  transactionSchema,
  filterSchema,
  statisticsSchema,
  idSchema,
} from "@tracker/shared";
import { config } from "./config.js";
import {
  UserModel,
  CategoryModel,
  TransactionModel,
  defaults,
  categoryDto,
  transactionDto,
} from "./models.js";
import { hashPassword, verifyPassword } from "./password.js";
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY === "true") app.set("trust proxy", 1);
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const visits = new Counter({
    name: "tracker_visits_total",
    help: "Browser application loads",
    registers: [registry],
  });
  const requests = new Counter({
    name: "tracker_http_requests_total",
    help: "HTTP responses",
    labelNames: ["method", "route", "status"],
    registers: [registry],
  });
  const duration = new Histogram({
    name: "tracker_http_duration_seconds",
    help: "HTTP latency",
    labelNames: ["method", "route"],
    registers: [registry],
  });
  app.use(helmet(), express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    const stop = duration.startTimer();
    res.on("finish", () => {
      const route = req.route?.path ?? "unmatched";
      requests.inc({ method: req.method, route, status: res.statusCode });
      stop({ method: req.method, route });
    });
    next();
  });
  app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/health/ready", async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw Error();
      await mongoose.connection.db!.admin().ping();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.use((req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== config.APP_ORIGIN
    )
      return next(new HttpError(403, "ORIGIN", "Источник запроса не разрешён"));
    next();
  });
  const limit = (max: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: max,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          error: {
            code: "RATE_LIMIT",
            message: "Слишком много запросов. Попробуйте позже.",
          },
        }),
    });
  app.post("/api/visits", limit(300), (_req, res) => {
    visits.inc();
    res.status(204).end();
  });
  const store = MongoStore.create({
    mongoUrl: config.MONGO_URI,
    ttl: 7 * 86400,
    autoRemove: "native",
  });
  app.use(
    session({
      name: "tracker.sid",
      secret: config.SESSION_SECRET,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.COOKIE_SECURE === "true",
        maxAge: 7 * 86400000,
      },
    }),
  );
  const authLimit = limit(30);
  async function signIn(req: Request, id: string) {
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.userId = id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
  }
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    const hash = await hashPassword(body.password);
    const user = await UserModel.create({
      email: body.email,
      passwordHash: hash,
    });
    try {
      await CategoryModel.insertMany(
        defaults.map((c) => ({ ...c, userId: user._id })),
      );
    } catch (e) {
      await CategoryModel.deleteMany({ userId: user._id });
      await user.deleteOne();
      throw e;
    }
    await signIn(req, String(user._id));
    res.status(201).json({ id: String(user._id), email: user.email });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    const user = await UserModel.findOne({ email: body.email });
    if (!user || !(await verifyPassword(body.password, user.passwordHash)))
      throw new HttpError(401, "CREDENTIALS", "Неверный email или пароль");
    await signIn(req, String(user._id));
    res.json({ id: String(user._id), email: user.email });
  });
  app.post("/api/auth/logout", async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((e) => (e ? reject(e) : resolve())),
    );
    res
      .clearCookie("tracker.sid", {
        httpOnly: true,
        sameSite: "lax",
        secure: config.COOKIE_SECURE === "true",
      })
      .status(204)
      .end();
  });
  app.use("/api", (req, _res, next) => {
    if (!req.session.userId)
      return next(new HttpError(401, "UNAUTHORIZED", "Войдите в аккаунт"));
    next();
  });
  app.get("/api/auth/me", async (req, res) => {
    const user = await UserModel.findById(req.session.userId);
    if (!user) throw new HttpError(401, "UNAUTHORIZED", "Войдите в аккаунт");
    res.json({ id: String(user._id), email: user.email });
  });
  app.get("/api/categories", async (req, res) =>
    res.json(
      (
        await CategoryModel.find({ userId: req.session.userId }).sort({
          createdAt: 1,
        })
      ).map(categoryDto),
    ),
  );
  app.post("/api/categories", async (req, res) => {
    const body = categorySchema.parse(req.body);
    res
      .status(201)
      .json(
        categoryDto(
          await CategoryModel.create({ ...body, userId: req.session.userId }),
        ),
      );
  });
  app.patch("/api/categories/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = categorySchema
      .omit({ kind: true })
      .partial()
      .extend({ archived: z.boolean().optional() })
      .strict()
      .parse(req.body);
    const c = await CategoryModel.findOneAndUpdate(
      { _id: id, userId: req.session.userId },
      body,
      { new: true },
    );
    if (!c) throw new HttpError(404, "NOT_FOUND", "Категория не найдена");
    res.json(categoryDto(c));
  });
  async function validateCategory(
    req: Request,
    body: z.infer<typeof transactionSchema>,
    existingCategory?: string,
  ) {
    const c = await CategoryModel.findOne({
      _id: body.categoryId,
      userId: req.session.userId,
      kind: body.kind,
    });
    if (!c || (c.archived && existingCategory !== String(c._id)))
      throw new HttpError(
        400,
        "CATEGORY",
        "Выберите доступную категорию соответствующего типа",
      );
  }
  app.get("/api/transactions", async (req, res) => {
    const q = filterSchema.parse(req.query);
    const filter: any = { userId: req.session.userId };
    if (q.kind) filter.kind = q.kind;
    if (q.categoryId) filter.categoryId = q.categoryId;
    if (q.from || q.to)
      filter.date = {
        ...(q.from ? { $gte: q.from } : {}),
        ...(q.to ? { $lte: q.to } : {}),
      };
    if (q.search)
      filter.comment = {
        $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    const [items, total] = await Promise.all([
      TransactionModel.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((q.page - 1) * 20)
        .limit(20),
      TransactionModel.countDocuments(filter),
    ]);
    res.json({
      items: items.map(transactionDto),
      total,
      page: q.page,
      pageSize: 20,
    });
  });
  app.post("/api/transactions", async (req, res) => {
    const body = transactionSchema.parse(req.body);
    await validateCategory(req, body);
    res.status(201).json(
      transactionDto(
        await TransactionModel.create({
          ...body,
          userId: req.session.userId,
        }),
      ),
    );
  });
  app.put("/api/transactions/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = transactionSchema.parse(req.body);
    const current = await TransactionModel.findOne({
      _id: id,
      userId: req.session.userId,
    });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Операция не найдена");
    await validateCategory(req, body, String(current.categoryId));
    Object.assign(current, body);
    await current.save();
    res.json(transactionDto(current));
  });
  app.delete("/api/transactions/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const t = await TransactionModel.findOneAndDelete({
      _id: id,
      userId: req.session.userId,
    });
    if (!t) throw new HttpError(404, "NOT_FOUND", "Операция не найдена");
    res.status(204).end();
  });
  app.get("/api/statistics", async (req, res) => {
    const q = statisticsSchema.parse(req.query);
    const owner = { userId: new mongoose.Types.ObjectId(req.session.userId) };
    const match = { ...owner, date: { $gte: q.from, $lte: q.to } };
    const [totals, balanceRows, series, cats] = await Promise.all([
      TransactionModel.aggregate([
        { $match: match },
        { $group: { _id: "$kind", amount: { $sum: "$amountMinor" } } },
      ]),
      TransactionModel.aggregate([
        { $match: owner },
        {
          $group: {
            _id: null,
            amount: {
              $sum: {
                $cond: [
                  { $eq: ["$kind", "income"] },
                  "$amountMinor",
                  { $multiply: ["$amountMinor", -1] },
                ],
              },
            },
          },
        },
      ]),
      TransactionModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $substrBytes: ["$date", 0, q.group === "day" ? 10 : 7] },
            income: {
              $sum: {
                $cond: [{ $eq: ["$kind", "income"] }, "$amountMinor", 0],
              },
            },
            expense: {
              $sum: {
                $cond: [{ $eq: ["$kind", "expense"] }, "$amountMinor", 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      TransactionModel.aggregate([
        { $match: { ...match, kind: "expense" } },
        { $group: { _id: "$categoryId", amount: { $sum: "$amountMinor" } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        { $sort: { amount: -1 } },
      ]),
    ]);
    const income = totals.find((t) => t._id === "income")?.amount ?? 0,
      expense = totals.find((t) => t._id === "expense")?.amount ?? 0;
    const points = new Map(
      series.map((p) => [
        p._id,
        { date: p._id, income: p.income, expense: p.expense },
      ]),
    );
    const cursor = new Date(q.from + "T00:00:00Z"),
      end = new Date(q.to + "T00:00:00Z");
    if (q.group === "month") cursor.setUTCDate(1);
    const filled = [];
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, q.group === "day" ? 10 : 7);
      filled.push(points.get(date) ?? { date, income: 0, expense: 0 });
      if (q.group === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
      else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    res.json({
      balance: balanceRows[0]?.amount ?? 0,
      income,
      expense,
      difference: income - expense,
      series: filled,
      categories: cats.map((c) => ({
        id: String(c._id),
        name: c.category.name,
        color: c.category.color,
        amount: c.amount,
      })),
    });
  });
  app.use((_req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "Страница не найдена")),
  );
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Проверьте данные",
          fields: z.flattenError(error).fieldErrors,
        },
      });
    if (error.code === 11000)
      return res.status(409).json({
        error: {
          code: "EMAIL_EXISTS",
          message: "Этот email уже зарегистрирован",
        },
      });
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({ error: { code: "JSON", message: "Некорректный JSON" } });
    if (error.type === "entity.too.large")
      return res.status(413).json({
        error: { code: "BODY_TOO_LARGE", message: "Запрос слишком большой" },
      });
    if (!(error instanceof HttpError)) console.error(error);
    res.status(error.status ?? 500).json({
      error: {
        code: error.code ?? "INTERNAL",
        message:
          error instanceof HttpError
            ? error.message
            : "Не удалось выполнить запрос",
      },
    });
  });
  return { app, registry, store };
}
