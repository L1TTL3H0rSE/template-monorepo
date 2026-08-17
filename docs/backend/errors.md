# Доменные ошибки

## Принцип

Сервис не решает, каким HTTP-статусом отвечать. Он присваивает ошибке
**категорию**, а перевод категории в статус живёт в одном месте — в `kit`.

```text
слой хранилища   pgx.ErrNoRows
     ↓
слой сценария    fmt.Errorf("%w: example %s", errorsx.ErrNotFound, id)
     ↓
транспорт        ginx.WriteDomainError(c, log, err)
     ↓
HTTP             404 {"error":true,"message":"Not found","code":"NOT_FOUND"}
```

## Категории

`kit/errorsx`:

| Категория | HTTP | Смысл |
|---|---|---|
| `ErrNotFound` | 404 | Объект не существует или не виден |
| `ErrValidation` | 400 | Вход не проходит правила |
| `ErrConflict` | 409 | Состояние не допускает операцию |
| `ErrForbidden` | 403 | Субъекту не разрешено |
| `ErrRateLimited` | 429 | Превышен лимит |
| `ErrUnavailable` | 503 | Зависимость недоступна |

Ошибка вне категорий — 500 с generic телом наружу и полной причиной в логе.

## Как объявлять свою ошибку

Оборачиванием, а не заведением параллельного набора:

```go
var ErrCharacterNameTaken = fmt.Errorf("%w: character name already taken", errorsx.ErrConflict)
```

После этого работают обе проверки:

```go
errors.Is(err, ErrCharacterNameTaken)   // конкретная причина — для сценария
errors.Is(err, errorsx.ErrConflict)     // категория — для транспорта
```

Именно поэтому обёртка, а не своя иерархия: транспорту нужна категория,
сценарию — конкретика, и обе доступны из одного значения.

## Что запрещено

### Свой `internal/infra/httperr`

```go
// Так делать НЕЛЬЗЯ:
func writeError(c *gin.Context, err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        c.JSON(404, ...)
    // ...
    }
}
```

Каждая такая таблица — отдельное мнение о том, что такое «конфликт». Через
полгода один сервис отвечает 409, другой 422, и клиент вынужден знать оба.

### Текст внутренней ошибки наружу

```go
// Так делать НЕЛЬЗЯ:
c.JSON(500, gin.H{"error": err.Error()})
```

Текст ошибки БД содержит имена таблиц, хостов и иногда значения полей.
`WriteInternalErrorWithErr` отдаёт наружу generic сообщение, а причину пишет в
лог вместе с `request_id`.

### Проглатывание ошибки

```go
// Так делать НЕЛЬЗЯ:
row, _ := s.q.GetExample(ctx, id)
```

Если ошибка действительно не важна — это утверждение, и оно пишется явно:

```go
// Уведомление не критично для сценария: логируем и продолжаем.
if err := s.notify(ctx, userID); err != nil {
    s.log.Warn("notify failed", zap.Error(err))
}
```

## Логирование ошибок

Логирует **тот, кто принял решение**, а не каждый слой по дороге. Ошибка,
записанная в лог на трёх уровнях, даёт три записи об одном событии и мешает
считать инциденты.

- Сервис логирует то, что решил проигнорировать.
- Транспорт логирует то, что превратилось в 500.
- Промежуточные слои просто оборачивают: `fmt.Errorf("get character: %w", err)`.

Обёртка с контекстом обязательна: `pgx.ErrNoRows` без указания операции
бесполезен в логе.

## Проверка

Контракт «категория → статус» покрыт тестом
`internal/infra/http/controllers/example/example_test.go`:

```go
{fmt.Errorf("%w: example", errorsx.ErrNotFound), http.StatusNotFound},
{fmt.Errorf("%w: bad", errorsx.ErrValidation), http.StatusBadRequest},
{fmt.Errorf("%w: taken", errorsx.ErrConflict), http.StatusConflict},
{fmt.Errorf("%w: nope", errorsx.ErrForbidden), http.StatusForbidden},
```

Тест падает, если кто-то завёл свою таблицу переводов в обход `ginx`.
