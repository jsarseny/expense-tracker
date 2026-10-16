import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = process.env.SMOKE_ORIGIN ?? "http://localhost";
const args = [
  "compose",
  "--env-file",
  process.env.SMOKE_ENV_FILE ?? ".env.example",
];
const compose = (...a) =>
  execFileSync("docker", [...args, ...a], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 180000,
  });
let cookie = "";
async function api(path, method = "GET", body, status = 200) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(
    r.status,
    status,
    `${method} ${path}: ${r.status} ${await r.clone().text()}`,
  );
  const c = r.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  return status === 204 ? null : r.json();
}
async function ready() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(base + "/api/health/ready", {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("Readiness timed out");
}
await ready();
assert.equal((await fetch(base)).status, 200);
assert.equal((await fetch(base + "/metrics")).status, 404);
await api(
  "/auth/register",
  "POST",
  { email: `smoke-${Date.now()}@example.ru`, password: "smoke-password123" },
  201,
);
const cats = await api("/categories");
const transaction = await api(
  "/transactions",
  "POST",
  {
    kind: "expense",
    amountMinor: 12345,
    categoryId: cats.find((c) => c.kind === "expense").id,
    date: "2026-10-15",
    comment: "Проверка сохранения",
  },
  201,
);
await api("/visits", "POST", undefined, 204);
compose("restart", "api");
await ready();
await api("/auth/me");
assert.equal((await api("/transactions")).items[0].id, transaction.id);
compose("restart", "mongo");
await ready();
assert.equal((await api("/transactions")).items[0].amountMinor, 12345);
compose("stop", "mongo");
try {
  await api("/health/live");
  await api("/health/ready", "GET", undefined, 503);
} finally {
  compose("start", "mongo");
}
await ready();
await api("/auth/me");
console.log(
  "PASS: frontend, health, private metrics, persistent sessions/data, readiness failure/recovery",
);
