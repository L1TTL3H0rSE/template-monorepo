# kit

Общая инфраструктурная библиотека всех Go-сервисов. Отдельный Go-модуль
`roleplay/kit`; сервисы подключают его через `replace ../kit`.

Правило: если код нужен второму сервису и не является доменным — он живёт
здесь, а не копируется. Если он доменный — он остаётся в `internal/` владельца.

| Пакет | Отвечает за |
|---|---|
| `bootstrap` | `Common` config + построение logger/cache/ratelimiter одним вызовом |
| `runtime` | Порядок старта и обратный порядок остановки компонентов и closers |
| `infra` | Интерфейс `InfrastructureService` (Start / GracefulShutdown) |
| `infra/http` | `Config` сервера и `NewEngine` со стандартной цепочкой middleware |
| `ginx` | Формы ответа, коды ошибок, `GinxParser`, `WriteDomainError` |
| `ginx/middlewares` | RequestID, access log, gateway user context, auth, rate limit |
| `errorsx` | Категории доменных ошибок (`ErrNotFound`, `ErrValidation`, …) |
| `configloader` | Загрузка конфигурации из env (+ локальный `.env`) |
| `logger` | zap в JSON |
| `cache` | Общий кеш с TTL и `Namespaced` |
| `ratelimiter` | Token bucket поверх `cache` |
| `adapters/postgres` | Пул pgx и запуск миграций сервиса |

## Что здесь НЕ должно появляться

- Доменные типы и правила конкретного сервиса.
- Ветвление по имени сервиса (`if serviceName == "gocharacters"`).
- Второй способ сделать то, что уже умеет существующий пакет: два формата
  ответа или две таблицы «ошибка → статус» расходятся молча.

## Проверка

```bash
go build ./...
go vet ./...
go test ./...
```
