# Память проекта

Подтверждённые факты и ловушки, которые трудно вывести из одного очевидного
файла. Это **не** журнал задач: для истории существует Git.

Запись содержит идентификатор, область, вывод, источники и дату проверки. Если
код опровергает запись — прав код: исправьте или удалите её в том же изменении.

---

### MEM-001 — Go-модули независимы

- **Область:** `backend/*`
- **Факт:** каждый каталог `backend/<module>` имеет собственный `go.mod`; общего
  `go.work` нет. Локальные `replace ../kit` — часть принятой схемы. Go-команды
  запускаются из каталога конкретного модуля, а не из корня.
- **Источники:** `backend/kit/go.mod`, `backend/gotemplate/go.mod`.
- **Проверено:** 2026-08-17.

### MEM-002 — sqlc сопоставляет override по внутреннему имени типа

- **Область:** `backend/*/sqlc/sqlc.yaml`
- **Факт:** для nullable-параметров запись `db_type: "bigint"` **не
  применяется** — нужен `pg_catalog.int8` (и `pg_catalog.int4`,
  `pg_catalog.bool`). Без них nullable остаётся `pgtype.*`, и сервис пишет
  ручные конвертеры.
- **Источники:** `backend/gotemplate/sqlc/sqlc.yaml`.
- **Проверено:** 2026-08-17.

### MEM-003 — порядок колонок в SELECT определяет форму сгенерированного типа

- **Область:** `backend/*/internal/query`
- **Факт:** sqlc переиспользует общий тип таблицы только при полном совпадении
  формы выборки со схемой. Иначе он порождает отдельный `<Query>Row` на каждый
  запрос одной и той же формы, и каждому нужен свой маппер. Колонка из поздней
  миграции стоит в таблице последней — значит, и в `SELECT`/`RETURNING` тоже.
- **Источники:** `backend/gotemplate/internal/query/example.sql`,
  `internal/query/models.go`.
- **Проверено:** 2026-08-17.

### MEM-004 — позиционные параметры дают имена вида `dollar_1`

- **Область:** `backend/*/internal/query`
- **Факт:** `$1` в запросе с несколькими параметрами порождает сигнатуру
  `CountExamples(ctx, dollar_1 string)`. `sqlc.arg('name')` и
  `sqlc.narg('name')` дают осмысленные имена; `narg` даёт указатель, отличая
  «не задано» от «пусто».
- **Источники:** `backend/gotemplate/internal/query/example.sql`.
- **Проверено:** 2026-08-17.

### MEM-005 — комментарий над `-- name:` попадает в сгенерированный код

- **Область:** `backend/*/internal/query`
- **Факт:** комментарий непосредственно перед `-- name: X` становится
  doc-комментарием метода и попадает в интерфейс `Querier`. Пояснения для
  разработчика пишите в документе или после строки `-- name:`.
- **Источники:** `backend/gotemplate/internal/query/querier.go`.
- **Проверено:** 2026-08-17.

### MEM-006 — golang-migrate выбирает драйвер по схеме URL

- **Область:** `backend/kit/adapters/postgres`
- **Факт:** схема `postgres://` уводит миграции на драйвер `lib/pq`, то есть на
  второй драйвер PostgreSQL в сборке. Для pgx нужна схема `pgx5://` — её строит
  `Config.MigrationDSN()`.
- **Источники:** `backend/kit/adapters/postgres/postgres.go`.
- **Проверено:** 2026-08-17.

### MEM-007 — Pinia разворачивает ref-ы во вложенных объектах

- **Область:** `frontend/applications/*/app/stores`
- **Факт:** setup-стор оборачивается в `reactive()`, который разворачивает ref-ы
  и во вложенных объектах. `store.pagination.totalPages.value` вернёт
  `undefined`; правильно `store.pagination.totalPages`. Ловится `nuxt typecheck`,
  но не тестами.
- **Источники:** `frontend/applications/web/app/pages/characters/index.vue`.
- **Проверено:** 2026-08-17.

### MEM-008 — `isAbsolute` обязателен в предикате `external` Rollup

- **Область:** `frontend/packages/components/vite.config.ts`
- **Факт:** точка входа приходит абсолютным путём, и на Windows он начинается с
  буквы диска. Предикат «всё, что не начинается с `.` или `/`, — внешнее»
  объявляет внешним сам entry, и сборка падает с
  `Entry module "src/index.ts" cannot be external`.
- **Источники:** `frontend/packages/components/vite.config.ts`.
- **Проверено:** 2026-08-17.

### MEM-009 — `:prop="false"` рендерит атрибут `prop="false"`

- **Область:** `frontend/packages/components/src/components`
- **Факт:** булев модификатор передаётся как `props.subtle || undefined`.
  Без `|| undefined` Vue отрендерит `subtle="false"`, и селектор `[subtle]`
  сработает — модификатор применится там, где его выключили.
- **Источники:** `frontend/packages/components/src/components/Badge.vue`.
- **Проверено:** 2026-08-17.

### MEM-010 — pnpm не поднимает транзитивные пакеты

- **Область:** `frontend/`
- **Факт:** `@storybook/vue3` приходит транзитивно с `@storybook/vue3-vite`, но
  в `node_modules` пакета не появляется. Импорт `Meta`/`StoryObj` требует
  явного объявления в `devDependencies`. То же верно для любого пакета, который
  импортируется в коде, но объявлен только у зависимости.
- **Источники:** `frontend/packages/components/package.json`,
  `frontend/pnpm-workspace.yaml`.
- **Проверено:** 2026-08-17.

### MEM-011 — имя CSS-файла в lib-режиме Vite зависит от имени пакета

- **Область:** `frontend/packages/components`
- **Факт:** без `build.lib.cssFileName` Vite называет собранный CSS по имени
  пакета (`components.css`), и экспорт `"./styles": "./dist/style.css"`
  указывает в никуда. Имя задано явно.
- **Источники:** `frontend/packages/components/vite.config.ts`.
- **Проверено:** 2026-08-17.

### MEM-012 — ведущий комментарий в `<template>` делает компонент multi-root

- **Область:** `frontend/packages/components/src/components`
- **Факт:** HTML-комментарий перед корневым элементом — тоже узел. Компонент
  становится multi-root, и атрибуты перестают попадать на корневой элемент:
  селекторы `[variant="..."]` молча не срабатывают, `wrapper.attributes()` в
  тестах возвращает пустоту, `$el` указывает не на тот узел. Пояснения пишутся
  в `<script setup>`; охраняет `test/template-root.test.ts`.
- **Источники:** `frontend/packages/components/test/template-root.test.ts`.
- **Проверено:** 2026-08-17.

### MEM-013 — покрытие v8 показывает ложные 100% для `.vue`

- **Область:** `frontend/**/vitest.config.ts`
- **Факт:** провайдер `v8` считает покрытие по инструментированному выводу.
  Файл `.vue`, который только импортировали, но ни разу не отрендерили,
  показывает 100%. Метрика обратна смыслу: чем больше компонентов подтягивает
  барель, тем «лучше» цифра. Лечится `coverage.experimentalAstAwareRemapping:
  true`.
- **Источники:** `frontend/packages/components/vitest.config.ts`.
- **Проверено:** 2026-08-17.

### MEM-014 — Node-окружение Vitest не видит `app/pages` и `app/layouts`

- **Область:** `frontend/applications/*/vitest.config.ts`
- **Факт:** страницам и layout нужны авто-импорты, роутер и runtime config
  Nuxt. Из Node-окружения они не загружаются и дают ноль покрытия, обесценивая
  общую цифру. Тесты разделены на `test/unit/**` (Node) и `test/nuxt/**`
  (`@nuxt/test-utils`, `mountSuspended`); каталоги страниц исключены из
  `coverage.include`.
- **Источники:** `frontend/applications/web/vitest.config.ts`.
- **Проверено:** 2026-08-17.

### MEM-015 — дефолт `max_connections` кончается на 10 сервисах

- **Область:** `docker-compose.yml`
- **Факт:** дефолт Postgres — 100 соединений; каждый Go-сервис держит свой пул
  (`DB_MAX_CONNS`, по умолчанию 10). Пятнадцать сервисов дают 150 соединений в
  покое. Падает не виновник, а сервис, подключившийся последним, — симптом
  выглядит как случайные 500 в произвольном месте.
- **Источники:** `docker-compose.yml`, `backend/kit/adapters/postgres/postgres.go`.
- **Проверено:** 2026-08-17.

### MEM-016 — один позиционный параметр в двух ролях даёт 42P08

- **Область:** `backend/*/internal/query`
- **Факт:** параметр, использованный и как значение колонки, и внутри `CASE`,
  оставляет Postgres без однозначного типа: `could not determine data type of
  parameter`. Ошибка возникает в рантайме при подготовке запроса, а НЕ на
  `sqlc generate` — генератор выводит типы своим анализатором и такой запрос
  пропускает. Лечится явным приведением в каждом использовании.
- **Источники:** [`docs/backend/sqlc-migrations.md`](backend/sqlc-migrations.md).
- **Проверено:** 2026-08-17.

### MEM-017 — сгенерированные protobuf-сообщения нельзя копировать

- **Область:** `backend/*/pkg/{rpc,events}`
- **Факт:** структуры `protoc-gen-go` содержат `sync.Mutex` внутри
  `protoimpl.MessageState`. Передача по значению — реальная ошибка, а не
  ложное срабатывание `go vet`. Отключение проверки `copylocks` прячет вместе с
  ней все рукописные копирования мьютексов. Правило: указатель везде, включая
  элементы срезов.
- **Источники:** [`docs/backend/nats-contracts.md`](backend/nats-contracts.md).
- **Проверено:** 2026-08-17.

### MEM-018 — `await load()` сразу после мутации возвращает список без записи

- **Область:** `frontend/applications/*/app/stores`
- **Факт:** между записью и её появлением в выдаче стоит конвейер БД → шина →
  индекс. `200 OK` означает «записано», а не «видно в списке». Немедленная
  перезагрузка почти всегда возвращает список без изменения; пользователь
  повторяет действие и создаёт настоящий дубликат. Локально не воспроизводится:
  на пустой БД задержка близка к нулю.
- **Источники:** `frontend/applications/web/app/stores/characters.ts`,
  [`ADR-0007`](decisions/0007-optimistic-ui-bounded-probe.md).
- **Проверено:** 2026-08-17.

### MEM-019 — регистр в именах файлов делает репозиторий неразрешимо грязным

- **Область:** генераторы, `frontend/packages/components/scripts`
- **Факт:** `Icons.vue` и `icons.vue` — два файла в ext4 и один в NTFS/APFS.
  Git хранит путь строкой и видит два. На Windows `git status` показывает
  вечное изменение, которое нельзя ни закоммитить, ни откатить. Причина обычно
  в генераторе: `fs.readdir` не гарантирует порядок, а `sort()` без явной
  локали зависит от локали машины.
- **Источники:** `frontend/packages/components/scripts/generate-component-index.mjs`,
  [`docs/conventions/cross-platform.md`](conventions/cross-platform.md).
- **Проверено:** 2026-08-17.

### MEM-020 — отмена запроса не является ошибкой сети

- **Область:** `frontend/packages/api/src/core`, сторы приложений
- **Факт:** latest-request-wins отменяет предыдущее чтение при старте каждого
  нового применённого (поиск дебаунсится, поэтому не на каждом нажатии
  клавиши). Если `ApiClient` заворачивает `AbortError` в `NetworkError`,
  пользователь видит «Сервис недоступен» при обычной работе с поиском. Отмена
  вынесена в отдельный тип `RequestCancelledError`; проверяются оба признака —
  имя ошибки от fetch и состояние сигнала, — и отдельно перехватывается разбор
  тела: `.catch(() => null)` вокруг `json()` превратил бы отмену в `TypeError`
  на `payload.data`.
- **Источники:** `frontend/packages/api/src/core/errors.ts`,
  `frontend/packages/api/test/client.test.ts`,
  `frontend/applications/web/app/stores/characters.ts`.
- **Проверено:** 2026-08-17.

### MEM-021 — сброс страницы при новом поиске даёт два чтения

- **Область:** `frontend/applications/*/app/stores`
- **Факт:** пара `pagination.reset(); load();` в наблюдателе за поисковым
  запросом выполняет ДВА чтения, если пользователь не на первой странице:
  сброс будит наблюдателя за номером страницы, и тот запускает своё. Второй
  запрос гарантированно отменяет первый, поэтому в devtools при каждом поиске
  виден отменённый запрос. Чтение должен выполнять ровно один наблюдатель.
- **Источники:** `frontend/applications/web/app/stores/characters.ts`,
  `frontend/applications/web/test/unit/characters-store.test.ts`.
- **Проверено:** 2026-08-17.

### MEM-022 — отмены без счётчика поколений недостаточно

- **Область:** `frontend/applications/*/app/stores`
- **Факт:** `AbortController` не отменяет уже разрешившийся промис. Если ответ
  успел прийти до `abort()`, устаревшее чтение всё равно запишет состояние.
  Поэтому стор держит и отмену (освобождает соединение), и монотонный счётчик
  поколений (гарантия, что записать может только актуальное чтение). Счётчик
  охраняет также `error` и снятие `pending`.
- **Источники:** `frontend/applications/web/app/stores/characters.ts`,
  `frontend/applications/web/test/unit/characters-store.test.ts`.
- **Проверено:** 2026-08-17.
