# Карта архитектуры

Навигационная карта фактически реализованной схемы. Детали контракта всегда
проверяются в коде владельца: роутер, миграции, конфигурация, типы портов.

## Путь пользовательского запроса

```text
Nuxt-приложение (@roleplay/web)
  -> app/pages          экран, только отображение и события
  -> app/stores | app/composables   состояние
  -> app/contracts      ПОРТ: интерфейс, который знает приложение
  -> app/adapters       реализация порта: http или mock
  -> @roleplay/api      ApiClient: базовый URL, токен, конверт {error, data}
  -> HTTP
  -> Go-сервис /api/v1/...
     -> kit/infra/http.NewEngine     Recovery, RequestID, access log, user context
     -> GatewayRequireAuth           единственная проверка аутентификации
     -> RateLimit                    после аутентификации
     -> controller                   транспорт: разбор и форма ответа
     -> service                      сценарий
     -> query.Querier (sqlc)         SQL
     -> PostgreSQL
```

Обратный путь ошибки:

```text
PostgreSQL: pgx.ErrNoRows
  -> service: fmt.Errorf("%w: ...", errorsx.ErrNotFound)
  -> controller: ginx.WriteDomainError
  -> HTTP 404 {error: true, code: "NOT_FOUND"}
  -> ApiClient: throw new ApiError(404, ...)
  -> adapter | store: понятное пользователю сообщение
```

Ни один слой не переводит ошибку дважды и ни один не изобретает свой набор
статусов.

## Границы репозитория

```text
backend/kit/          общая инфраструктура Go-сервисов
backend/gotemplate/   эталонный сервис; новый сервис начинается с его копии
frontend/packages/    переиспользуемые пакеты
frontend/applications/ деплоимые приложения
docs/                 паттерны и решения
docker/               образы и локальный рантайм
```

## Устройство Go-сервиса

```text
cmd/app/                  entrypoint: сигналы -> app.Run
config/                   Common + доменные блоки конфигурации
internal/app/             composition root и жизненный цикл
internal/domain/dtos/     единственный слой форм
internal/infra/http/      сервер, роутер, контроллеры
internal/infra/services/  сценарии
internal/query/           SQL и сгенерированный sqlc-код
migrations/               схема, которой владеет сервис
pkg/                      ПУБЛИЧНЫЕ контракты для других сервисов
proto/                    source of truth межсервисных контрактов
```

Ключевые правила:

- `internal/` принадлежит только своему модулю. Между сервисами импортируется
  только `pkg/`.
- Интерфейс объявляется рядом с **потребителем** и только если у него есть
  потребитель. Общего пакета `ports` нет.
- Сервис не читает таблицы другого сервиса. Междоменная ссылка разрешается
  через публичный контракт владельца.
- Новый слой заводится под доказанного потребителя, а не «для симметрии».

Подробно — [`backend/layers.md`](backend/layers.md).

## Устройство фронтенда

```text
@roleplay/components   визуальные примитивы, токены, Storybook
@roleplay/shared       headless-состояние (без стилей и компонентов)
@roleplay/api          транспорт и схемы формы JSON
@roleplay/web          приложение: contracts -> adapters -> stores -> pages
```

Направление зависимостей одностороннее:

```text
web -> components
web -> shared
web -> api
components -X-> api        компонент не знает про HTTP
shared     -X-> components состояние не знает про стили
api        -X-> vue        транспорт не знает про фреймворк
```

Каждая из трёх запрещённых стрелок стоит конкретной возможности:

- `components -> api` лишает возможности показать компонент в Storybook;
- `shared -> components` лишает возможности переиспользовать состояние во
  втором приложении;
- `api -> vue` лишает возможности вызвать API из скрипта, теста или SSR.

## Симметрия между слоями

Схема сознательно одинакова на обеих сторонах:

| Идея | Backend | Frontend |
|---|---|---|
| Интерфейс у потребителя | локальный `service interface` в контроллере | `app/contracts` |
| Реализация | `internal/infra/services` | `app/adapters/{http,mock}` |
| Сборка зависимостей | `internal/app/app.go` | `app/api/api.ts` |
| Форма данных | `internal/domain/dtos` | доменные типы в `contracts` |
| Единая ошибка | `errorsx` + `WriteDomainError` | `ApiError` |

Разработчик, понявший одну сторону, ориентируется во второй без отдельного
объяснения.

## Когда требуется синхронное обновление

- **Новый Go-сервис**: копия `gotemplate`, запись в `docker-compose.yml`,
  каталог разрешений, обновление [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Новый публичный контракт**: контракт владельца, обработчик, потребители,
  тесты.
- **Новый frontend-пакет**: `pnpm-workspace.yaml`, зависимости `workspace:*`,
  lock-файл, порядок сборки в `build:local`.
- **Новое сквозное решение**: ADR в [`decisions/`](decisions/). Если решение
  меняет устойчивый факт — обновите эту карту.
