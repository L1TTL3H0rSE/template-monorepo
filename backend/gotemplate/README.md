# gotemplate

Эталонный Go-сервис. Новый сервис начинается с копии этого каталога, а не с
пустого `go mod init`.

`gotemplate` — не просто пример: он является **исполняемым определением
паттерна**. Если общий приём меняется, он меняется здесь, и остальные сервисы
подтягиваются к новой форме. Доменную особенность одного сервиса в шаблон не
вносят.

## Структура

```text
cmd/app/                       entrypoint: сигналы -> app.Run
config/                        Common + доменные блоки конфигурации
internal/app/                  composition root и жизненный цикл
internal/domain/dtos/          единственный слой форм (Input / Patch / View)
internal/infra/http/           сервер, роутер, контроллеры
internal/infra/services/       сценарии
internal/query/                SQL-источник и сгенерированный sqlc-код
migrations/                    схема, которой владеет сервис
pkg/permissions/               публичный каталог разрешений владельца
proto/                         source of truth межсервисных контрактов
sqlc/sqlc.yaml                 конфигурация генератора
magefile.go                    канонические команды
```

Разбор каждого слоя и причин — в [`docs/backend/`](../../docs/backend/).

## Быстрый старт

```bash
cp .env.example .env
go run github.com/magefile/mage dev:setup
docker compose --parallel 4 up -d postgres
go run github.com/magefile/mage database:up
go run ./cmd/app
```

`.env` — первый шаг, а не необязательный: `DB_NAME` умолчания не имеет, и без
него и миграции, и приложение падают на старте. Умолчание здесь было бы опаснее
падения — команда ушла бы в служебную базу `postgres` успешно и молча.

- HTTP API: `http://localhost:8080`
- Health: `http://localhost:8080/health`

## Проверка

```bash
go build ./...
go vet ./...
go test ./...
```

`internal/infra/http/router_test.go` перебирает все зарегистрированные маршруты
и падает, если маршрут отвечает не 401 без заголовков гейтвея. Новый публичный
маршрут требует осознанной правки списка `publicRoutes`.

## Изменение схемы

1. `go run github.com/magefile/mage database:create <name>` — новая пара
   up/down. Применённую миграцию не переписывают.
2. Запрос в `internal/query/*.sql`.
3. `go run github.com/magefile/mage generate:sqlc`.
4. Сценарий в `internal/infra/services/`, затем хендлер и маршрут.

Файлы с `Code generated ... DO NOT EDIT` меняются только через источник и
генератор.

## Межсервисные контракты

`proto/rpc.proto` и `proto/events.proto` — source of truth subjects и форм
сообщений. Генератор в шаблоне намеренно не завендорен: выбор кодогенератора
остаётся за проектом. Правила владения контрактом описаны в
[`docs/backend/nats-contracts.md`](../../docs/backend/nats-contracts.md).
