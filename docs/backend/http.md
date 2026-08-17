# HTTP-слой

## Движок и порядок middleware

Движок собирает `kit/infra/http.NewEngine`, а не `gin.Default()`:

```text
Recovery -> [trace] -> RequestID -> ZapAccessLog -> GatewayUserContext
```

Почему не `gin.Default()`: его логгер пишет не-JSON и дублирует `ZapAccessLog`.

Порядок не произволен:

| Позиция | Причина |
|---|---|
| `Recovery` первым | Паника в любом следующем middleware должна быть поймана |
| `RequestID` до логгера | Иначе запись лога уйдёт без идентификатора |
| `GatewayUserContext` последним | Логгер уже пишет `user_id`, а хендлеры получают готовый контекст |

Аутентификация и rate limit в движок НЕ входят: они ставятся на конкретную
группу маршрутов, потому что публичные маршруты (`/health`) есть в каждом
сервисе.

## Аутентификация: одно место и один тест

Внутренний сервис **не проверяет bearer-токен**. Токен проверяет гейтвей, после
чего удаляет `Authorization` и выставляет доверенные заголовки `X-User-*`.

```go
api := router.Group("/api/v1")
api.Use(middlewares.GatewayRequireAuth())   // единственная проверка
```

### Почему в хендлере проверку повторять нельзя

```go
// Так делать НЕЛЬЗЯ:
func (h *Handler) GetByID(c *gin.Context) {
    p := ginx.NewGinxParser(c)
    if !p.IsAuthenticated() {          // до сюда запрос не дойдёт
        ginx.WriteErrorResponse(c, ginx.Unauthorized)
        return
    }
    // ...
}
```

Эта строка не выполняет никакой работы — но выглядит как проверка доступа.
Читатель видит «здесь есть авторизация» и не задаёт единственный важный вопрос:
**а можно ли ЭТОМУ пользователю ЭТОТ объект?** Ложная проверка вытесняет
настоящую.

### Что защищает вместо неё

`internal/infra/http/router_test.go` перебирает все зарегистрированные маршруты
и падает, если маршрут отвечает не 401 без заголовков гейтвея:

```go
router := NewRouter(Deps{})   // нулевые зависимости: до хендлеров не дойдёт

for _, route := range router.Routes() {
    if publicRoutes[route.Method+" "+route.Path] {
        continue
    }
    // ... ожидаем 401
}
```

Тест ловит именно то, что случается на практике: маршрут случайно
зарегистрировали вне защищённой группы. Ручная проверка в хендлере такой случай
не ловит — её просто забудут вместе с группой.

Новый публичный маршрут требует правки списка `publicRoutes`, то есть
осознанного решения.

### Роль ≠ доступ

`GatewayRequireRole` проверяет realm-роль из токена. Это **не** доменная
авторизация: роль описывает, кем пользователь является, а не что ему разрешено
с конкретным объектом. Подробно — [`permissions.md`](permissions.md).

## Разбор запроса

Единая точка — `ginx.GinxParser`. Ручной `c.Param` + `uuid.Parse` не
используется.

| Что | Как |
|---|---|
| Path-параметр | `p.GetPathUUID("id")`, `p.GetPathInt("page")` |
| Один query-параметр | `p.GetQueryString("q")` |
| Несколько query-параметров | `ginx.ParseQuery[T](c)` |
| JSON-тело | `c.ShouldBindJSON(&input)` прямо в `dtos.*Input` |

### Почему набор query разбирается структурой

```go
type ExampleSearchQuery struct {
    Q    string `form:"q"    validate:"omitempty,max=100"`
    From int    `form:"from" validate:"gte=0"`
    Size int    `form:"size" validate:"gte=0,lte=100"`
}

q, err := ginx.ParseQuery[ExampleSearchQuery](c)
```

Ограничения (`lte=100`) лежат рядом с полем, а не в теле хендлера. Цепочка
`p.GetQueryInt` + ручные `if` разъезжается: один эндпоинт ограничивает размер
страницы, соседний забывает, и запрос с `size=100000` уходит в БД.

## Форма ответа

Один конверт на весь проект:

```json
{ "error": false, "message": "", "data": { } }
{ "error": true, "message": "Not found", "code": "NOT_FOUND" }
```

| Ситуация | Вызов |
|---|---|
| 200 с телом | `ginx.WriteSuccessResponse(c, view)` |
| 201 | `ginx.WriteSuccessResponseCreated(c, view)` |
| 200 без тела | `ginx.WriteOK(c)` |
| 204 | `ginx.WriteNoContent(c)` |
| Страница | `ginx.WritePaginatedResponse(c, items, page, perPage, total)` |
| Доменная ошибка | `ginx.WriteDomainError(c, log, err)` |
| Известная ошибка транспорта | `ginx.WriteErrorResponse(c, ginx.BadRequest)` |

`code` в ошибке существует, чтобы клиент ветвился по коду, а не по тексту:
текст меняется при первой же правке формулировки.

## Rate limit

Ставится на группу **после** аутентификации: ключом становится UUID
пользователя, иначе IP.

Два решения, зафиксированных в `kit/ginx/middlewares/ratelimit.go`:

1. **Fail-open.** Ошибка хранилища лимитера пропускает запрос и пишет
   предупреждение. Отказ в обслуживании из-за сбоя вспомогательного хранилища
   дороже, чем разовое превышение лимита.
2. **Уважение гейтвея.** Если гейтвей уже применил общий лимит, он передаёт
   `X-Gateway-RateLimit-Applied: true`, и сервис не расходует тот же лимит
   повторно.

Заголовки ответа: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`; при отказе — 429 и `Retry-After`.

## Swagger

Документация генерируется из аннотаций рядом с хендлером:

```go
// @Summary      Получить пример по ID
// @Tags         example
// @Produce      json
// @Param        id   path      string  true  "UUID примера"
// @Success      200  {object} ginx.SuccessResponse[dtos.ExampleView]
// @Failure      404  {object} ginx.ErrorResponse
// @Router       /api/v1/example/{id} [get]
```

```bash
go run github.com/magefile/mage generate:swag
```

Аннотация рядом с кодом, а не в отдельном файле спецификации: спецификация,
живущая отдельно, расходится с реализацией в первый же спринт.
