# template-monorepo

Шаблон проекта: Go-бэкенд, pnpm-workspace фронтенда, дизайн-система со Storybook
и Nuxt-приложение.

Это не набор заготовок «на всякий случай»: каждый файл здесь — работающий
пример принятого паттерна, а паттерны с их причинами разобраны в
[`docs/`](docs/README.md).

## Требования

- Go 1.25+
- Node.js 20+, pnpm 10+
- Docker (для PostgreSQL)

## Быстрый старт

```bash
# 1. Инфраструктура
docker compose --parallel 4 up -d postgres

# 2. Бэкенд
cd backend/gotemplate
go run github.com/magefile/mage dev:setup   # sqlc, migrate, swag — однократно
go run ./cmd/app                            # http://localhost:8080

# 3. Фронтенд (в другом терминале)
cd frontend
pnpm install
pnpm build:local                            # пакеты экспортируют dist — собрать обязательно
pnpm --filter @roleplay/web dev             # http://localhost:3000
```

Приложение по умолчанию работает на фикстурах (`NUXT_PUBLIC_API_PROVIDER=mock`)
и поднимается без бэкенда.

Витрина дизайн-системы:

```bash
pnpm storybook                              # http://localhost:6006
```

## Использование как шаблона

Репозиторий одновременно является рабочей референс-реализацией и шаблоном для
новых проектов. После клонирования (или создания из GitHub template):

```bash
node scripts/init-project.mjs \
  --display-name "Acme" \
  --slug acme \
  --repository-name acme-platform \
  --npm-scope @acme \
  --go-module-prefix github.com/acme/acme-platform
```

Скрипт заменяет идентичность проекта, разделяет память шаблона и проекта и
генерирует список унаследованных ADR к пересмотру. Демонстрационные домены
(`gotemplate`, `example`, `character`) остаются рабочим кодом до осознанной
замены.

Полный лайфцикл — [`docs/TEMPLATE.md`](docs/TEMPLATE.md).

## Структура

```text
backend/
  kit/              общая инфраструктура Go-сервисов
  gotemplate/       эталонный сервис — с его копии начинается новый
frontend/
  packages/
    components/     дизайн-система + Storybook
    shared/         headless-состояние
    api/            транспорт и схемы
    eslint-config/  общие правила
  applications/
    web/            Nuxt-приложение
docs/               паттерны и решения
docker/             образы
```

## Проверки

```bash
# backend
(cd backend/kit && go build ./... && go vet ./...)
(cd backend/gotemplate && go build ./... && go vet ./... && go test ./...)

# frontend
(cd frontend && pnpm build:local && pnpm lint && pnpm typecheck && pnpm test)
```

Полный список и порядок — [`docs/conventions/checks.md`](docs/conventions/checks.md).

## С чего начать чтение

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — карта и границы.
2. [`docs/backend/layers.md`](docs/backend/layers.md) — как написан бэкенд и
   чего в нём намеренно нет.
3. [`docs/frontend/scss-bem.md`](docs/frontend/scss-bem.md) — соглашения по
   стилям.
4. [`docs/frontend/api-and-adapters.md`](docs/frontend/api-and-adapters.md) —
   ключевой паттерн фронтенда.
5. [`docs/decisions/`](docs/decisions/) — почему выбрано именно так.

## Три вещи, которые ломают больше всего времени

1. **Пакеты фронтенда экспортируют `dist`.** Правка в `packages/*/src` не видна
   приложению до `pnpm build:local`.
2. **Go-модули независимы.** Команды запускаются из каталога модуля, а не из
   корня репозитория.
3. **Сгенерированные файлы правятся только через источник.** `internal/query/*`,
   `src/components/index.ts`, `_breakpoints.*` — правка «на месте» потеряется
   молча.

## Что заменить под свой проект

- Домен `example` в `backend/gotemplate` — на свой.
- Палитру в `frontend/packages/components/src/assets/scss/colors.scss`.
- Домен `character` в `frontend/applications/web` — на свой.
- Точки подключения аутентификации: `backend/kit/ginx/middlewares` и
  `frontend/applications/web/app/api/api.ts`.
