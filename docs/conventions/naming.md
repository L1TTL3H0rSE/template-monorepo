# Именование

## Go

| Что | Как | Пример |
|---|---|---|
| Модуль | `starter/<имя>` | `starter/gotemplate` |
| Каталог сервиса | `go<домен>` | `gocharacters` |
| Пакет | одно слово, строчными | `example`, `dtos`, `query` |
| Экспортируемое | `PascalCase` | `GetByID`, `ExampleView` |
| Неэкспортируемое | `camelCase` | `toView`, `defaultPageSize` |
| Интерфейс у потребителя | по роли, строчными | `service`, `userNotifier` |
| Ошибка | `Err<Что>` | `ErrCharacterNameTaken` |
| Тест | `Test<Что><Ожидание>` | `TestGetByIDMapsNoRowsToNotFound` |

Имя пакета не повторяется в имени типа: `example.Service`, а не
`example.ExampleService`.

Аббревиатуры пишутся целиком в одном регистре: `ID`, `HTTP`, `URL`, `UUID` —
`GetByID`, а не `GetById`.

### Пакет по роли, а не по типу

```text
internal/infra/services/example/     ✔ домен
internal/infra/http/controllers/     ✔ роль

internal/utils/                      ✘ куда угодно
internal/helpers/                    ✘ то же самое
internal/common/                     ✘ то же самое
```

Пакет с таким именем через полгода содержит несвязанный код, который никто не
решается тронуть, потому что непонятно, кто им пользуется.

## TypeScript и Vue

| Что | Как | Пример |
|---|---|---|
| Пакет | `@starter/<имя>` | `@starter/components` |
| Компонент (файл и имя) | `PascalCase` | `TextField.vue` |
| Композабл | `use<Что>` | `useSearchQuery` |
| Стор | `use<Что>Store` | `useCharactersStore` |
| Тип/интерфейс | `PascalCase` | `CharacterApi`, `ButtonProps` |
| Props-тип компонента | `<Компонент>Props` | `ButtonProps` |
| Файл утилит | `camelCase.ts` | `promises.ts` |
| Генерируемый файл | префикс `_` | `_breakpoints.ts` |
| Тест | `<что>.test.ts` | `client.test.ts` |
| История | `<Компонент>.stories.ts` | `Button.stories.ts` |

### Идентификатор стора

```ts
defineStore("characters", ...)          // ✔ домен
defineStore("components/modals", ...)   // ✔ пространство пакета
defineStore("data", ...)                // ✘
```

Идентификатор виден в devtools и в персистентном хранилище — он должен что-то
значить.

## CSS

| Что | Как | Пример |
|---|---|---|
| Блок | `kebab-case` | `.text-field` |
| Элемент | `&__<элемент>` | `.text-field__label` |
| Модификатор | HTML-атрибут | `[variant="outlined"]` |
| CSS-переменная блока | `--<блок>-<свойство>` | `--button-accent-color` |
| Токен | `--<роль>-<оттенок>-color` | `--primary-hover-color` |
| SCSS-переменная | `$<категория>-<имя>` | `$z-index-modal` |

Имя токена описывает **роль**, а не значение: `--primary-main-color`, а не
`--purple-500`. Смена палитры не должна требовать переименования.

Подробно — [`frontend/scss-bem.md`](../frontend/scss-bem.md).

## База данных

| Что | Как | Пример |
|---|---|---|
| Таблица | единственное число, `snake_case` | `character`, `campaign_member` |
| Колонка | `snake_case` | `created_at`, `author_id` |
| Первичный ключ | `id` | |
| Внешний ключ | `<таблица>_id` | `author_id` |
| Индекс | `<таблица>_<колонки>_idx` | `character_name_idx` |
| Миграция | `NNNNNN_<что_делает>` | `000002_add_character_status` |

Имя миграции описывает действие, а не «update»: `add_character_status` понятно
через год, `fix2` — нет.

## HTTP

```text
GET    /api/v1/characters          список
POST   /api/v1/characters          создание
GET    /api/v1/characters/:id      чтение
PATCH  /api/v1/characters/:id      частичное обновление
DELETE /api/v1/characters/:id      удаление
```

- Множественное число для коллекции.
- Версия в пути: `/api/v1/`.
- `snake_case` в JSON-полях — как в БД; перевод в `camelCase` делает адаптер
  фронтенда.
- Действие, не укладывающееся в CRUD, — подресурс:
  `POST /characters/:id/publish`, а не `POST /publishCharacter`.

## Git

```text
feat/character-search       новая возможность
fix/pagination-reset        исправление
refactor/extract-adapter    без изменения поведения
docs/scss-conventions       документация
```

Сообщение коммита: что изменилось и **зачем**, если «зачем» не очевидно.

```text
fix: сбрасывать страницу при новом поисковом запросе

Без сброса пользователь ищет со страницы 5 и попадает на пустую
страницу 5 новой выдачи.
```

## Общее правило

> Имя описывает **роль**, а не тип и не реализацию.

`characterAdapter`, а не `characterService2`. `useSearchQuery`, а не
`useDebouncedInputHandler`. Имя, в котором закреплена реализация, устаревает при
первом же рефакторинге.
