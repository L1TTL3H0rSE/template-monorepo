# Тестирование бэкенда

## Что тестируется

| Слой | Что проверяем | Чем |
|---|---|---|
| Роутер | Каждый маршрут закрыт аутентификацией | `router_test.go`, нулевые зависимости |
| Контроллер | Разбор запроса, категория ошибки → статус, значения по умолчанию | `httptest` + заглушка сценария |
| Сценарий | Правила, переводы ошибок, граничные случаи | Фейк `query.Querier` |
| SQL | Совместимость запроса со схемой | `sqlc generate` — на генерации, не в тесте |

Последняя строка важна: несоответствие SQL схеме ловится генератором. Писать
тест, который это проверяет, — дублировать работу инструмента.

## Фейк вместо мока

Сервис принимает сгенерированный `query.Querier`. Тест подставляет фейк через
встраивание интерфейса:

```go
type fakeQuerier struct {
    query.Querier   // не реализованные в тесте методы паникуют — намеренно

    example query.Example
    getErr  error
}

func (f *fakeQuerier) GetExample(_ context.Context, _ uuid.UUID) (query.Example, error) {
    if f.getErr != nil {
        return query.Example{}, f.getErr
    }
    return f.example, nil
}
```

Три следствия, ради которых так, а не через библиотеку моков:

1. **Встроенный интерфейс держит фейк честным.** Изменилась сигнатура метода —
   фейк перестаёт компилироваться. Мок, сгенерированный из старого интерфейса,
   продолжит «работать» и пройдёт тест, которого больше не существует в
   реальности.
2. **Паника на неожиданном методе.** Если тест вызвал метод, который не
   объявлен, он падает сразу и с понятным местом — вместо тихого нулевого
   значения.
3. **Ноль зависимостей.** Ни генератора, ни библиотеки, ни шага сборки.

## Пример: перевод ошибки

Самая ценная проверка сценарного слоя — что `pgx.ErrNoRows` превращается в
доменную категорию:

```go
func TestGetByIDMapsNoRowsToNotFound(t *testing.T) {
    svc := New(&fakeQuerier{getErr: pgx.ErrNoRows}, nil)

    _, err := svc.GetByID(context.Background(), uuid.New())

    if !errors.Is(err, errorsx.ErrNotFound) {
        t.Fatalf("err = %v, want errorsx.ErrNotFound", err)
    }
}
```

И обратная проверка — что **не всякая** ошибка становится 404:

```go
func TestGetByIDPropagatesUnknownError(t *testing.T) {
    sentinel := errors.New("connection reset")
    svc := New(&fakeQuerier{getErr: sentinel}, nil)

    _, err := svc.GetByID(context.Background(), uuid.New())

    if errors.Is(err, errorsx.ErrNotFound) {
        t.Fatal("неизвестная ошибка БД не должна становиться 404")
    }
}
```

Без второго теста легко написать `return nil, errorsx.ErrNotFound` на любую
ошибку — и потерять все сбои БД, показав пользователю «не найдено».

## Тест роутера

Ключевой тест шаблона:

```go
router := NewRouter(Deps{})   // нулевые зависимости

for _, route := range router.Routes() {
    if publicRoutes[route.Method+" "+route.Path] {
        continue
    }
    // запрос без заголовков гейтвея обязан дать 401
}
```

Он не требует БД, не требует моков и ловит самый дорогой класс ошибки: маршрут,
случайно зарегистрированный вне защищённой группы.

Нулевой `Deps` — часть проверки: если запрос дошёл до хендлера, тест упадёт на
nil-разыменовании, что тоже правильный результат.

## Тест контроллера

Проверяются три вещи, за которые отвечает транспорт:

```go
// 1. разбор пути
router.ServeHTTP(rec, httptest.NewRequest("GET", "/example/not-a-uuid", nil))
// -> 400

// 2. категория ошибки -> статус
{fmt.Errorf("%w: example", errorsx.ErrNotFound), http.StatusNotFound},

// 3. ограничения query
router.ServeHTTP(rec, httptest.NewRequest("GET", "/example?size=1000", nil))
// -> 400, потому что validate:"lte=100"
```

Бизнес-правила здесь не проверяются: они принадлежат сценарию, и там их
тестировать дешевле.

## Именование

```go
func TestGetByIDMapsNoRowsToNotFound(t *testing.T)   // что делает и что ожидаем
func TestUpdateRejectsEmptyPatch(t *testing.T)
```

Имя описывает поведение, а не метод. `TestGetByID` не даёт понять, что сломалось,
когда падает.

Сообщение об ошибке содержит и полученное, и ожидаемое:

```go
t.Fatalf("status = %d, want %d (маршрут не закрыт GatewayRequireAuth)", rec.Code, 401)
```

Пояснение в скобках экономит чтение теста при разборе падения в CI.

## Команды

```bash
go test ./...                  # весь модуль
go test ./internal/infra/...   # один слой
go test -run TestEveryAPIRoute ./internal/infra/http
go test -race ./...            # при работе с общим состоянием
```

## Чего не делаем

| Практика | Почему нет |
|---|---|
| Поднимать БД для юнит-теста | Медленно и нестабильно; `Querier` уже даёт шов |
| Мокать `*gin.Context` | `httptest` даёт настоящий контекст без обмана |
| Тестировать сгенерированный код | Его корректность — ответственность генератора |
| Assert на точный текст ошибки | Текст меняется; проверяется категория через `errors.Is` |
