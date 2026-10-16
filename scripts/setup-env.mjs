import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env уже существует; настройки сохранены.");
  process.exit(0);
}
const random = () => randomBytes(24).toString("hex");
let contents = readFileSync(".env.example", "utf8");
contents = contents
  .replace("replace-with-a-random-secret-at-least-32-characters", random())
  .replace("replace-root-password-alphanumeric", random())
  .replace("replace-app-password-alphanumeric", random())
  .replace("replace-grafana-password", random());
writeFileSync(".env", contents, { mode: 0o600, flag: "wx" });
console.log(
  "Создан .env со случайными паролями. Для VPS задайте APP_ORIGIN=http://IP_СЕРВЕРА.",
);
