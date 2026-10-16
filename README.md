# Поток — трекер расходов

Русскоязычное приложение для личных финансов. Только темная тема; один баланс в рублях. Регистрация по email и паролю, доходы и расходы, свои категории с начальным набором, фильтры и графики. Данные каждого аккаунта изолированы.

## Быстрый запуск в Docker

Нужны Docker Engine с Compose v2.24+ и Node.js 22 для генератора настроек. Для приложения достаточно 2 ГБ RAM; для приложения с мониторингом рекомендуется VPS с 4 ГБ.

```sh
node scripts/setup-env.mjs
docker compose up -d --build --wait
```

Открыть [http://localhost](http://localhost). Создайте аккаунт; категории появятся автоматически, баланс начнется с нуля. Настройки находятся в `.env`, пароль Grafana — в `GRAFANA_ADMIN_PASSWORD`. Генератор не перезаписывает существующий `.env`.

Перед первым запуском на сервере задайте `APP_ORIGIN=http://IP_СЕРВЕРА`. Если меняете `APP_PORT`, добавьте порт и в `APP_ORIGIN`. Для разработки интерфейса origin должен совпадать с адресом Vite.

При отсутствии Node.js скопируйте `.env.example` в `.env` и самостоятельно замените все значения `replace-*`. Используйте для паролей MongoDB буквы и цифры, либо URL-кодируйте пароль в URI.

MongoDB хранится в volume `expense-tracker_mongo-data`. Обычные `restart`, пересборка и `down` сохраняют данные. Пароли и пользователь MongoDB создаются **только при первом запуске пустого volume**: изменение переменных окружения само по себе не меняет уже созданных пользователей БД.

## Стек и устройство

Пароли хешируются `scrypt` с индивидуальной солью. Сессии хранятся в MongoDB, срок — 7 дней. Cookie: `HttpOnly`, `SameSite=Lax`; выход удаляет сессию. Есть проверка Origin, ограничение попыток входа и валидация запросов. Конфигурация HTTP соответствует выбранному варианту развертывания. При подключении HTTPS установите `COOKIE_SECURE=true`, HTTPS origin и настройте внешний reverse proxy с корректной передачей протокола.

## Локальная разработка и проверки

```sh
npm ci
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait mongo
```

В локальный `.env` добавьте `MONGO_URI=mongodb://tracker:ПАРОЛЬ_ИЗ_MONGO_APP_PASSWORD@127.0.0.1:27017/tracker?authSource=tracker`, `APP_ORIGIN=http://localhost:5173`. Затем `npm run dev`. Vite — порт 5173, API — 3000, внутренние метрики — 3001. Если порт API занят, задайте `PORT=3100` в `.env`, а Vite запускайте с `API_PROXY_TARGET=http://127.0.0.1:3100` в окружении. Для самого Vite переменные процесса имеют приоритет; proxy по умолчанию — `127.0.0.1:3000`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

API-тесты автоматически поднимают временную MongoDB. Можно передать `TEST_MONGO_URI` на отдельную тестовую БД; ее имя обязано заканчиваться на `_test`, коллекции в ней очищаются. E2E используют отдельные порты 3100/3101/5180 и создают тестовые аккаунты в БД из `MONGO_URI`. Можно проверить готовый контейнерный frontend: `E2E_BASE_URL=http://localhost npm run test:e2e` (PowerShell: `$env:E2E_BASE_URL='http://localhost'`).

Контейнерные проверки используют **тестовое** `.env.example`:

```sh
docker compose --env-file .env.example up -d --build --wait
node scripts/container-smoke.mjs
bash scripts/rollback-test.sh
```

`container-smoke` перезапускает API и MongoDB и кратковременно останавливает MongoDB; запускайте его в тестовой среде. Он проверяет сохранение операций и сессий, доступность frontend, закрытый `/metrics`, отказ readiness и восстановление. Playwright проверяет полный цикл операций, категории, вход после выхода, мобильную ширину, русские ошибки и отсутствие повторного счета посещений при навигации.

## Мониторинг

На Linux VPS:

```sh
docker compose --profile monitoring up -d --wait
ssh -L 3002:127.0.0.1:3002 -L 9090:127.0.0.1:9090 user@server
```

Открыть [Grafana](http://localhost:3002), пользователь `admin`, пароль из `.env`. Дашборд «Поток — мониторинг» и источник данных создаются автоматически. [Prometheus](http://localhost:9090) доступен через тот же туннель. Эти порты слушают только localhost VPS; MongoDB и endpoint метрик не опубликованы наружу.

Для Docker Desktop используйте:

```sh
docker compose -f compose.yaml -f compose.desktop.yaml --profile monitoring up -d --wait
```

На Docker Desktop метрики ресурсов относятся к **Linux VM Docker**, а не ко всей Windows/macOS. На Linux — к хосту VPS. node-exporter собирает CPU, доступную/используемую RAM и диски; cAdvisor — потребление и лимиты контейнеров. У cAdvisor есть привилегированный доступ для чтения системных метрик. Лимиты CPU/RAM приложения заданы в Compose; их можно изменить под VPS.

Посещение — один POST `/api/visits` на загрузку приложения, в том числе обновление страницы. Переходы React Router и повторный mount StrictMode не добавляют посещений. Это число загрузок, не уникальных людей. График использует `increase(tracker_visits_total[1h])`, то есть скользящий час; Prometheus учитывает сброс счетчика после перезапуска процесса. Между загрузкой и ближайшим scrape возможна потеря события при аварийном завершении API. История метрик — 15 дней в отдельном volume.

Также доступны доступность frontend/API, задержка p95, частота запросов и ошибок 5xx, состояние сборщиков. Проверка: `node scripts/monitoring-smoke.mjs`. Исходник генератора дашборда — `deploy/generate-dashboard.mjs`; после изменений выполните `node deploy/generate-dashboard.mjs` и перезапустите Grafana.

## CI/CD и подготовка VPS

Pull request запускает CI. Push в `main` и ручной запуск workflow деплоя сначала выполняют тот же CI, затем публикуют два образа в GHCR с тегом commit SHA и разворачивают их по SSH. CI включает типы, lint, интеграционные тесты с MongoDB, сборку, Chromium E2E, Docker smoke, проверку мониторинга и проверку rollback.

Подготовьте Ubuntu VPS с Docker Engine, Compose plugin, `bash`, `flock` и SSH. Разрешите входящий порт 80 и SSH. Пользователь деплоя должен иметь доступ к Docker и каталогу проекта:

```sh
sudo install -d -o "$USER" -g "$USER" /opt/expense-tracker/releases
# Создайте /opt/expense-tracker/.env по .env.example со случайными секретами.
chmod 600 /opt/expense-tracker/.env
```

В GitHub Environment `production` задайте secrets:

| Secret            | Содержимое                                                                        |
| ----------------- | --------------------------------------------------------------------------------- |
| `SSH_HOST`        | IP или hostname VPS                                                               |
| `SSH_USER`        | Пользователь деплоя                                                               |
| `SSH_PORT`        | SSH-порт, необязательно; по умолчанию 22                                          |
| `SSH_PRIVATE_KEY` | Приватный ключ отдельного пользователя деплоя                                     |
| `SSH_KNOWN_HOSTS` | Проверенная запись host key сервера; для нестандартного порта — `[host]:port`     |
| `GHCR_READ_TOKEN` | Необязательный token с `read:packages`; иначе используется токен запуска workflow |

У Actions должны быть разрешены публикация packages и доступ к образам репозитория. Доступ пользователя registry соответствует `github.actor`. Не добавляйте `.env`, приватные ключи или дампы в Git.

Релизы хранятся в `/opt/expense-tracker/releases/<SHA>`, `.env` общий, `current` указывает на последний успешный релиз. Деплой сериализован через GitHub concurrency и серверный `flock`. При неудачном старте или readiness script возвращает конфигурацию и образы предыдущего релиза, сохраняя volumes. При первом неудачном деплое предыдущего релиза еще нет: исправьте причину по логам и повторите workflow. Несовместимые изменения схемы БД в эту версию не входят.

Ручной возврат к сохраненному релизу:

```sh
bash /opt/expense-tracker/releases/ПРЕДЫДУЩИЙ_SHA/deploy/deploy.sh ghcr.io/owner/repository
```

Фактическая публикация в GHCR и деплой требуют вашего GitHub-репозитория, VPS и указанных secrets.

## Резервное копирование

Из каталога локального проекта с `.env`, либо из серверного `current` с `COMPOSE_ENV_FILES=/opt/expense-tracker/.env`:

```sh
bash deploy/backup.sh /secure/backups/tracker.archive.gz
# Восстановление в остановленную для пользователей среду:
docker compose exec -T mongo sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop' < /secure/backups/tracker.archive.gz
```

Храните резервные копии отдельно от VPS. Восстановление с `--drop` заменяет коллекции из дампа.

## API

Все изменяющие запросы должны содержать `Origin`, совпадающий с `APP_ORIGIN`. Авторизованные запросы используют cookie `tracker.sid`.

| Метод и путь                                          | Назначение                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `POST /api/auth/register`, `POST /api/auth/login`     | `{email,password}` → `{id,email}` + cookie                   |
| `GET /api/auth/me`, `POST /api/auth/logout`           | Текущий пользователь / удаление сессии                       |
| `GET /api/categories`, `POST /api/categories`         | Список / создание `{name,kind,color,icon}`                   |
| `PATCH /api/categories/:id`                           | Изменение имени, цвета, иконки, `archived`; тип неизменяем   |
| `GET /api/transactions`                               | Фильтры `from,to,kind,categoryId,search,page`; по 20 записей |
| `POST /api/transactions`, `PUT /api/transactions/:id` | `{kind,amountMinor,categoryId,date,comment}`                 |
| `DELETE /api/transactions/:id`                        | Удаление операции                                            |
| `GET /api/statistics`                                 | Обязательные `from,to`; `group=day\|month`, период до 10 лет |
| `POST /api/visits`                                    | Счетчик загрузок, без авторизации                            |
| `GET /api/health/live`, `GET /api/health/ready`       | Liveness / доступность MongoDB (`503` при отказе)            |

`kind`: `income` или `expense`. Цвета и иконки определены в `packages/shared`. Ошибки: `{error:{code,message,fields?}}`, HTTP `400/401/403/404/409/429/500`. Общие типы ответов экспортируются из `@tracker/shared`. `/metrics` доступен только на внутреннем порту API 3001.
