import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
let mongo: MongoMemoryServer | undefined;
let system: ReturnType<typeof import("../src/app.js").createApp>;
let createApp: typeof import("../src/app.js").createApp;
let models: typeof import("../src/models.js");
const origin = "http://localhost:5173";
const credentials = { email: "person@example.ru", password: "password123" };
const agent = () => request.agent(system.app);
type Agent = ReturnType<typeof agent>;
async function register(a: Agent, email = credentials.email) {
  return a
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ ...credentials, email })
    .expect(201);
}
async function category(a: Agent, kind = "expense") {
  const r = await a.get("/api/categories").expect(200);
  return r.body.find((c: any) => c.kind === kind);
}
async function add(a: Agent, overrides: Record<string, unknown> = {}) {
  const cat = await category(a);
  return a
    .post("/api/transactions")
    .set("Origin", origin)
    .send({
      kind: "expense",
      amountMinor: 12345,
      categoryId: cat.id,
      date: "2026-10-15",
      comment: "Покупка",
      ...overrides,
    });
}
beforeAll(async () => {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri("tracker_test");
  }
  if (!new URL(uri).pathname.endsWith("_test"))
    throw Error("TEST_MONGO_URI must use a database ending in _test");
  process.env.MONGO_URI = uri;
  process.env.APP_ORIGIN = origin;
  process.env.TRUST_PROXY = "false";
  process.env.COOKIE_SECURE = "false";
  ({ createApp } = await import("../src/app.js"));
  models = await import("../src/models.js");
  await mongoose.connect(uri);
  await models.UserModel.init();
});
beforeEach(async () => {
  await Promise.all([
    models.UserModel.deleteMany({}),
    models.CategoryModel.deleteMany({}),
    models.TransactionModel.deleteMany({}),
    mongoose.connection.db!.collection("sessions").deleteMany({}),
  ]);
  system = createApp();
  await system.store.collectionP;
});
afterEach(async () => {
  system.registry.clear();
  await system.store.close();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
describe("Аккаунты и сессии", () => {
  it("нормализует email, создает категории, не возвращает хеш", async () => {
    const a = agent();
    const r = await register(a, "Person@Example.ru");
    expect(r.body).toEqual({
      id: expect.any(String),
      email: credentials.email,
    });
    expect((await a.get("/api/categories")).body).toHaveLength(9);
    const u = await models.UserModel.findOne();
    expect(u!.passwordHash).not.toContain(credentials.password);
    expect(r.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(r.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
  });
  it("отклоняет дубли email и неверные пароли, завершает сессию", async () => {
    const a = agent();
    await register(a);
    await registerDuplicate();
    async function registerDuplicate() {
      await a
        .post("/api/auth/register")
        .set("Origin", origin)
        .send(credentials)
        .expect(409);
    }
    await a.post("/api/auth/logout").set("Origin", origin).expect(204);
    await a.get("/api/auth/me").expect(401);
    await a
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ ...credentials, password: "wrongpass" })
      .expect(401);
    await a
      .post("/api/auth/login")
      .set("Origin", origin)
      .send(credentials)
      .expect(200);
    await a.get("/api/auth/me").expect(200);
  });
  it("сохраняет сессию при пересоздании API и отклоняет истекшую сессию", async () => {
    const a = agent();
    const r = await register(a);
    const cookie = r.headers["set-cookie"][0].split(";")[0];
    await system.store.close();
    system.registry.clear();
    system = createApp();
    await request(system.app)
      .get("/api/auth/me")
      .set("Cookie", cookie)
      .expect(200);
    await mongoose.connection
      .db!.collection("sessions")
      .updateMany({}, { $set: { expires: new Date(0) } });
    await request(system.app)
      .get("/api/auth/me")
      .set("Cookie", cookie)
      .expect(401);
  });
  it("проверяет ввод, Origin и ограничивает попытки входа", async () => {
    const a = agent();
    await a
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ email: "invalid", password: "x" })
      .expect(400);
    await a
      .post("/api/auth/register")
      .set("Origin", "http://evil.example")
      .send(credentials)
      .expect(403);
    await a.post("/api/auth/register").send(credentials).expect(403);
    for (let i = 0; i < 30; i++)
      await a.post("/api/auth/login").set("Origin", origin).send(credentials);
    const limited = await a
      .post("/api/auth/login")
      .set("Origin", origin)
      .send(credentials);
    expect(limited.status).toBe(429);
  });
});
describe("Операции и категории", () => {
  it("создает, изменяет и удаляет операции без потери копеек", async () => {
    const a = agent();
    await register(a);
    const r = await add(a);
    expect(r.status).toBe(201);
    expect(r.body.amountMinor).toBe(12345);
    await a
      .put(`/api/transactions/${r.body.id}`)
      .set("Origin", origin)
      .send({ ...r.body, amountMinor: 101, comment: "Обновлено" })
      .expect(200);
    const list = await a.get("/api/transactions");
    expect(list.body.items[0].amountMinor).toBe(101);
    await a
      .delete(`/api/transactions/${r.body.id}`)
      .set("Origin", origin)
      .expect(204);
    expect((await a.get("/api/transactions")).body.total).toBe(0);
  });
  it("изолирует операции и категории двух аккаунтов", async () => {
    const a = agent(),
      b = agent();
    await register(a);
    await register(b, "other@example.ru");
    const r = await add(a);
    expect((await b.get("/api/transactions")).body.total).toBe(0);
    await b
      .delete(`/api/transactions/${r.body.id}`)
      .set("Origin", origin)
      .expect(404);
    await b
      .put(`/api/transactions/${r.body.id}`)
      .set("Origin", origin)
      .send(r.body)
      .expect(404);
    await b
      .patch(`/api/categories/${r.body.categoryId}`)
      .set("Origin", origin)
      .send({ name: "Чужое" })
      .expect(404);
    expect((await add(b, { categoryId: r.body.categoryId })).status).toBe(400);
    const stats = await b.get("/api/statistics?from=2026-10-01&to=2026-10-31");
    expect(stats.body.balance).toBe(0);
  });
  it("проверяет тип, архивирование и восстановление категории", async () => {
    const a = agent();
    await register(a);
    const r = await add(a);
    const cat = await category(a);
    expect((await add(a, { kind: "income", categoryId: cat.id })).status).toBe(
      400,
    );
    await a
      .patch(`/api/categories/${cat.id}`)
      .set("Origin", origin)
      .send({ archived: true })
      .expect(200);
    expect((await add(a, { categoryId: cat.id })).status).toBe(400);
    await a
      .put(`/api/transactions/${r.body.id}`)
      .set("Origin", origin)
      .send({ ...r.body, comment: "В архивной категории" })
      .expect(200);
    await a
      .patch(`/api/categories/${cat.id}`)
      .set("Origin", origin)
      .send({ archived: false, name: "Новая подпись" })
      .expect(200);
    expect((await add(a, { categoryId: cat.id })).status).toBe(201);
    await a
      .patch(`/api/categories/${cat.id}`)
      .set("Origin", origin)
      .send({ kind: "income" })
      .expect(400);
  });
  it("валидирует суммы, даты и идентификаторы", async () => {
    const a = agent();
    await register(a);
    for (const overrides of [
      { amountMinor: 0 },
      { amountMinor: -1 },
      { amountMinor: 1.2 },
      { amountMinor: 100_000_000_001 },
      { date: "2026-02-30" },
      { categoryId: "invalid" },
    ])
      expect((await add(a, overrides)).status).toBe(400);
    await a.delete("/api/transactions/wrong").set("Origin", origin).expect(400);
    await a.get("/api/transactions?from=2026-11-01&to=2026-10-01").expect(400);
  });
  it("применяет фильтры, экранирует поиск и пагинацию", async () => {
    const a = agent();
    const user = await register(a);
    const cat = await category(a);
    await models.TransactionModel.insertMany(
      Array.from({ length: 23 }, (_, i) => ({
        userId: user.body.id,
        categoryId: cat.id,
        kind: "expense",
        amountMinor: 100,
        date: i === 0 ? "2026-09-30" : "2026-10-15",
        comment: i === 1 ? "Кофе (утро)" : "Покупка",
      })),
    );
    const first = await a.get("/api/transactions");
    expect(first.body.items).toHaveLength(20);
    expect(first.body.total).toBe(23);
    expect((await a.get("/api/transactions?page=2")).body.items).toHaveLength(
      3,
    );
    expect(
      (await a.get("/api/transactions?from=2026-10-01&to=2026-10-31")).body
        .total,
    ).toBe(22);
    expect(
      (await a.get("/api/transactions?search=" + encodeURIComponent("(утро)")))
        .body.total,
    ).toBe(1);
    expect((await a.get("/api/transactions?kind=income")).body.total).toBe(0);
    expect(
      (await a.get("/api/transactions?categoryId=" + cat.id)).body.total,
    ).toBe(23);
  });
});
describe("Статистика и мониторинг", () => {
  it("считает общий баланс, границы периода и пустые дни", async () => {
    const a = agent();
    await register(a);
    const income = await category(a, "income");
    await add(a, {
      kind: "income",
      categoryId: income.id,
      amountMinor: 100000,
      date: "2026-09-30",
    });
    await add(a, { amountMinor: 101, date: "2026-10-01" });
    await add(a, { amountMinor: 202, date: "2026-10-31" });
    await add(a, { amountMinor: 404, date: "2026-11-01" });
    const r = await a.get("/api/statistics?from=2026-10-01&to=2026-10-31");
    expect(r.body).toMatchObject({
      balance: 99293,
      income: 0,
      expense: 303,
      difference: -303,
    });
    expect(r.body.series).toHaveLength(31);
    expect(r.body.series[0].expense).toBe(101);
    expect(r.body.series[30].expense).toBe(202);
    expect(r.body.categories[0].amount).toBe(303);
    const monthly = await a.get(
      "/api/statistics?from=2026-09-01&to=2026-11-30&group=month",
    );
    expect(monthly.body.series).toHaveLength(3);
    expect(monthly.body.series[0].income).toBe(100000);
  });
  it("отдает пустую сводку, проверяет периоды и health", async () => {
    const a = agent();
    await register(a);
    const r = await a.get("/api/statistics?from=2026-10-01&to=2026-10-02");
    expect(r.body).toMatchObject({
      balance: 0,
      income: 0,
      expense: 0,
      categories: [],
    });
    await a.get("/api/statistics?from=2026-10-31&to=2026-10-01").expect(400);
    await a.get("/api/health/live").expect(200);
    await a.get("/api/health/ready").expect(200);
  });
  it("считает загрузки приложения, не публикует метрики через API", async () => {
    const a = agent();
    await a.post("/api/visits").set("Origin", origin).expect(204);
    await a.post("/api/visits").set("Origin", origin).expect(204);
    const metrics = await system.registry.metrics();
    expect(metrics).toContain("tracker_visits_total 2");
    expect(metrics).toContain("process_resident_memory_bytes");
    await a.get("/metrics").expect(404);
  });
});
