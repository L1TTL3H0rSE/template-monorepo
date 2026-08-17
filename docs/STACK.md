# Стек

Снимок проверен **2026-08-17**. Версии ниже нужны для ориентации; перед
обновлением зависимости сверяйтесь с манифестом и lock-файлом конкретного
модуля — они, а не этот документ, являются источником истины.

## Backend

- Каждый каталог `backend/<module>` — **самостоятельный Go-модуль**. Общего
  `go.work` намеренно нет.
- Go `1.25`.
- HTTP — Gin.
- PostgreSQL через pgx v5 и sqlc.
- Миграции — `golang-migrate`, каталог `migrations/` внутри сервиса.
- Логирование — zap (JSON).
- Общая инфраструктура — локальный модуль `backend/kit`, подключается через
  `replace ../kit`.
- Эталон прикладного сервиса — `backend/gotemplate`.

### Почему модули независимы, а не один `go.work`

Общий workspace-файл делает сборку одного сервиса зависимой от компилируемости
всех остальных. Независимые модули с локальным `replace` дают тот же удобный
локальный цикл разработки, но сломанный сосед не мешает работать.

Команды запускаются из каталога модуля:

```bash
cd backend/gotemplate
go build ./...
go vet ./...
go test ./...
```

### Инструменты генерации

| Инструмент | Зачем | Установка |
|---|---|---|
| `sqlc` | Go-код из SQL | `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` |
| `migrate` | Миграции | `go install github.com/golang-migrate/migrate/v4/cmd/migrate@latest` |
| `swag` | Swagger из аннотаций | `go install github.com/swaggo/swag/cmd/swag@latest` |
| `mage` | Канонические команды | `go run github.com/magefile/mage <target>` |

Одной командой: `go run github.com/magefile/mage dev:setup`.

## Frontend

`frontend/` — отдельный pnpm-workspace:

- Node.js `>= 20`, pnpm `10.x`.
- Nuxt 4, Vue 3.5, Pinia 3, TypeScript 5.9.
- Стили — SCSS (`sass-embedded`).
- Витрина — Storybook 8 с фреймворком `@storybook/vue3-vite`.
- Тесты — Vitest + happy-dom.
- Валидация ответов — zod.

Версии общих зависимостей — в `catalog:` файла `pnpm-workspace.yaml`,
внутренние — через `workspace:*`. Lock-файл один: `frontend/pnpm-lock.yaml`.

### Почему catalog, а не версии в каждом манифесте

Vue, установленный в двух версиях, даёт два экземпляра рантайма: `provide` из
одного не виден `inject` из другого, а ошибка выглядит как «инъекция не
работает». Catalog делает такую ситуацию невозможной по построению.

## Локальная инфраструктура

Корневой `docker-compose.yml` поднимает PostgreSQL и сервисы. Наружу публикуется
только то, что нужно для разработки.

```bash
docker compose --parallel 4 up -d
```

`--parallel` указывается явно: без него сборка нескольких образов
последовательная и занимает кратно больше времени.

## Чего в шаблоне нет намеренно

| Отсутствует | Причина |
|---|---|
| CI-конфигурация | Зависит от площадки; проверки описаны в `docs/conventions/checks.md` |
| Аутентификация | Зависит от выбранного провайдера; точка подключения размечена в `kit/ginx/middlewares` и `app/api/api.ts` |
| Кодогенератор межсервисных контрактов | Выбор за проектом; сам паттерн зафиксирован в `docs/backend/nats-contracts.md` |
| Трассировка | Точка подключения оставлена в `kit/infra/http.RouterOptions.TraceMiddleware` |

Каждый пропуск — это размеченная точка расширения, а не забытая работа.
