import { writeFileSync } from "node:fs";
const datasource = { type: "prometheus", uid: "prometheus" };
const definitions = [
  ["Доступность приложения", "probe_success", "short", "{{instance}}"],
  [
    "Посещения за час",
    "increase(tracker_visits_total[1h])",
    "short",
    "Посещения",
  ],
  [
    "CPU хоста, занято",
    '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))',
    "percent",
    "Занято",
  ],
  [
    "CPU хоста, доступно",
    '100 * avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))',
    "percent",
    "Свободно",
  ],
  [
    "RAM хоста, занято",
    "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes",
    "bytes",
    "Занято",
  ],
  [
    "RAM хоста, доступно",
    "node_memory_MemAvailable_bytes",
    "bytes",
    "Доступно",
  ],
  [
    "Диск: доступно",
    'node_filesystem_avail_bytes{mountpoint=~"/|/var/lib",fstype!~"tmpfs|overlay"}',
    "bytes",
    "Доступно",
  ],
  [
    "Диск: всего",
    'node_filesystem_size_bytes{mountpoint=~"/|/var/lib",fstype!~"tmpfs|overlay"}',
    "bytes",
    "Всего",
  ],
  [
    "CPU контейнеров, ядра",
    'sum by (name) (rate(container_cpu_usage_seconds_total{image!="",name!=""}[5m]))',
    "short",
    "{{name}}",
  ],
  [
    "RAM контейнеров",
    'container_memory_working_set_bytes{image!="",name!=""}',
    "bytes",
    "{{name}}",
  ],
  [
    "Лимиты RAM контейнеров",
    'container_spec_memory_limit_bytes{image!="",name!=""}',
    "bytes",
    "{{name}}",
  ],
  [
    "Лимиты CPU контейнеров, ядра",
    'container_spec_cpu_quota{image!="",name!=""} / container_spec_cpu_period{image!="",name!=""}',
    "short",
    "{{name}}",
  ],
  [
    "Запросы API в секунду",
    "sum by (route) (rate(tracker_http_requests_total[5m]))",
    "reqps",
    "{{route}}",
  ],
  [
    "Ошибки API 5xx в секунду",
    'sum(rate(tracker_http_requests_total{status=~"5.."}[5m])) or vector(0)',
    "reqps",
    "Ошибки",
  ],
  [
    "Задержка API, p95",
    "histogram_quantile(0.95, sum by (le) (rate(tracker_http_duration_seconds_bucket[5m])))",
    "s",
    "p95",
  ],
  ["Состояние сборщиков", "up", "short", "{{job}}"],
];
const panels = definitions.map(([title, expr, unit, legendFormat], i) => ({
  id: i + 1,
  title,
  type: "timeseries",
  datasource,
  gridPos: { x: (i % 2) * 12, y: Math.floor(i / 2) * 8, w: 12, h: 8 },
  targets: [{ refId: "A", expr, legendFormat }],
  fieldConfig: {
    defaults: {
      unit,
      color: { mode: "palette-classic" },
      custom: { drawStyle: "line", fillOpacity: 8, lineWidth: 2 },
    },
    overrides: [],
  },
  options: {
    legend: { displayMode: "list", placement: "bottom" },
    tooltip: { mode: "multi" },
  },
}));
writeFileSync(
  new URL("./monitoring/tracker.json", import.meta.url),
  JSON.stringify(
    {
      uid: "expense-tracker",
      title: "Поток — мониторинг",
      schemaVersion: 41,
      version: 1,
      timezone: "browser",
      refresh: "15s",
      time: { from: "now-6h", to: "now" },
      tags: ["tracker"],
      panels,
    },
    null,
    2,
  ) + "\n",
);
