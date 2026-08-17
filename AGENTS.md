# Правила для AI-агентов

Действуют во всём репозитории.

## Перед изменением

1. Прочитай [`docs/README.md`](docs/README.md) — индекс паттернов.
2. Прочитай документ по затронутой области:
   [`docs/backend/`](docs/backend/) или [`docs/frontend/`](docs/frontend/).
3. Проверь [`docs/PROJECT_MEMORY.md`](docs/PROJECT_MEMORY.md) на известные
   ловушки в этой области.
4. Проверь `git status --short`. Уже существующие изменения принадлежат
   пользователю: не очищай, не stash-ь и не перезаписывай их.

## Источники истины

При расхождении приоритет такой:

1. исполняемый код, конфигурация, миграции, тесты;
2. принятые ADR в [`docs/decisions/`](docs/decisions/);
3. документы в `docs/` и README компонентов;
4. память проекта.

Документ, разошедшийся с кодом, исправляется в том же изменении.

## Эталоны

| Область | Эталон |
|---|---|
| Go-сервис | `backend/gotemplate` |
| Общая Go-инфраструктура | `backend/kit` |
| Компонент дизайн-системы | `frontend/packages/components/src/components/Button.vue` |
| Композабл | `frontend/packages/shared/src/**` |
| Слой данных приложения | `frontend/applications/web/app/{contracts,adapters,api}` |

Новый код повторяет форму эталона. Общий приём меняется **в эталоне**, а не в
одном месте.

## Границы

- `internal/` принадлежит только своему Go-модулю. Между сервисами импортируется
  только `pkg/`.
- Сервис не читает таблицы другого сервиса.
- Компонент дизайн-системы не знает про HTTP, роутер и домен.
- `@roleplay/shared` не знает про стили и компоненты.
- Компоненты приложения не импортируют `@roleplay/api` напрямую — только через
  `app/contracts` и `app/adapters`.

## Генерируемые файлы

Не редактируются вручную:

```text
backend/*/internal/query/{db,models,querier}.go, *.sql.go
frontend/packages/components/src/components/index.ts
frontend/packages/components/src/assets/scss/_breakpoints.scss
frontend/packages/components/src/utils/_breakpoints.ts
```

Изменение делается в источнике, затем запускается генератор:

```bash
go run github.com/magefile/mage generate:sqlc
pnpm --filter @roleplay/components generate
```

## Проверки

Обязательны до объявления работы завершённой; полный список —
[`docs/conventions/checks.md`](docs/conventions/checks.md).

```bash
# backend, из каталога модуля
go build ./... && go vet ./... && go test ./...

# frontend, из frontend/
pnpm build:local && pnpm lint && pnpm typecheck && pnpm test
```

Красная проверка — причина остановиться, а не понизить порог.

## Что требует отдельного решения

Эти изменения не делаются «по пути» — они нуждаются в явном согласовании и, как
правило, в ADR:

- новый слой в Go-сервисе (репозиторий, доменная модель);
- новый публичный маршрут вне `GatewayRequireAuth`;
- новый экспорт в публичной поверхности `@roleplay/components`;
- изменение межсервисного контракта;
- новая зависимость в `catalog:`;
- изменение границ пакетов.

## Стиль

- Документация и комментарии — по-русски; идентификаторы и коммиты — по-английски.
- Комментарий объясняет **почему**, а не пересказывает код.
- Новая переменная окружения добавляется в `.env.example` в том же изменении.
- Новая ветка стилей получает историю в Storybook.
