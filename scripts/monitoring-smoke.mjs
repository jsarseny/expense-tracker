import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const prom = process.env.PROMETHEUS_URL ?? "http://127.0.0.1:9090";
async function query(expr) {
  const r = await fetch(
    prom + "/api/v1/query?" + new URLSearchParams({ query: expr }),
    { signal: AbortSignal.timeout(10000) },
  );
  assert(r.ok);
  const json = await r.json();
  assert.equal(json.status, "success");
  return json.data.result;
}
const metrics = [
  'up{job="api"}',
  'up{job="node"}',
  'up{job="containers"}',
  "probe_success",
  "tracker_visits_total",
  "node_memory_MemAvailable_bytes",
  "node_filesystem_avail_bytes",
  'container_memory_working_set_bytes{name!="",image!=""}',
  'container_spec_cpu_quota{name!="",image!=""}',
];
let pending = metrics;
for (let i = 0; i < 30 && pending.length; i++) {
  const failed = [];
  for (const expr of pending) {
    try {
      const rows = await query(expr);
      const health = expr.startsWith("up") || expr === "probe_success";
      const good =
        rows.length &&
        (health
          ? rows.every((r) => Number(r.value[1]) === 1)
          : rows.some(
              (r) =>
                Number(r.value[1]) >= (expr === "tracker_visits_total" ? 0 : 1),
            ));
      if (!good) failed.push(expr);
    } catch {
      failed.push(expr);
    }
  }
  pending = failed;
  if (pending.length) await new Promise((r) => setTimeout(r, 3000));
}
assert.deepEqual(pending, [], "Missing or unhealthy metrics");
const r = await fetch("http://127.0.0.1:3002/api/health");
assert(r.ok);
assert.equal((await r.json()).database, "ok");
const envText = readFileSync(
  process.env.SMOKE_ENV_FILE ?? ".env.example",
  "utf8",
);
const password =
  process.env.GRAFANA_ADMIN_PASSWORD ??
  envText.match(/^GRAFANA_ADMIN_PASSWORD=(.+)$/m)?.[1].trim();
assert(password, "Set GRAFANA_ADMIN_PASSWORD");
const dashboard = await fetch(
  "http://127.0.0.1:3002/api/dashboards/uid/expense-tracker",
  {
    headers: {
      Authorization:
        "Basic " + Buffer.from("admin:" + password).toString("base64"),
    },
  },
);
assert.equal(dashboard.status, 200, "Grafana dashboard provisioning");
const definition = (await dashboard.json()).dashboard;
assert.equal(definition.panels.length, 16);
let missing = definition.panels;
for (let attempt = 0; attempt < 30 && missing.length; attempt++) {
  const next = [];
  for (const panel of missing) {
    let populated = true;
    for (const target of panel.targets) {
      const rows = await query(target.expr);
      if (!rows.some((row) => Number.isFinite(Number(row.value[1]))))
        populated = false;
    }
    if (!populated) next.push(panel);
  }
  missing = next;
  if (missing.length) await new Promise((resolve) => setTimeout(resolve, 3000));
}
assert.deepEqual(
  missing.map((panel) => panel.title),
  [],
  "Dashboard panels must contain data",
);
console.log(
  "PASS: Prometheus targets, host/container metrics, visits, health probes, Grafana and all 16 dashboard panels",
);
