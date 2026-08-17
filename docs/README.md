# Документация проекта

Здесь зафиксированы паттерны, по которым написан этот шаблон, и **причины**, по
которым выбраны именно они. Документ без причины бесполезен: правило, смысл
которого неизвестен, нарушают при первом же неудобстве.

## Порядок чтения

| Документ | Когда нужен |
|---|---|
| [`TEMPLATE.md`](TEMPLATE.md) | Старт нового проекта из этого шаблона |
| [`STACK.md`](STACK.md) | Перед выбором версии, команды или инструмента |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Перед изменением границ, контрактов, слоёв |
| [`conventions/naming.md`](conventions/naming.md) | Всегда: как называть файлы, типы, ветки |
| [`conventions/checks.md`](conventions/checks.md) | Перед завершением задачи |
| [`conventions/cross-platform.md`](conventions/cross-platform.md) | Генераторы, регистр имён, воспроизводимость |
| [`conventions/documentation.md`](conventions/documentation.md) | Когда решение нужно зафиксировать |
| [`decisions/`](decisions/) | Причины принятых сквозных решений |
| [`PROJECT_MEMORY.md`](PROJECT_MEMORY.md) | Подтверждённые ловушки, которые трудно вывести из кода |

## Backend

| Документ | Тема |
|---|---|
| [`backend/service-anatomy.md`](backend/service-anatomy.md) | Каталоги сервиса и что где лежит |
| [`backend/layers.md`](backend/layers.md) | Слои, интерфейсы, чего в шаблоне нет и почему |
| [`backend/http.md`](backend/http.md) | Роутер, middleware, аутентификация, разбор запроса |
| [`backend/errors.md`](backend/errors.md) | Категории доменных ошибок и перевод в HTTP |
| [`backend/config-bootstrap-runtime.md`](backend/config-bootstrap-runtime.md) | Конфигурация, composition root, жизненный цикл |
| [`backend/sqlc-migrations.md`](backend/sqlc-migrations.md) | Схема, запросы, генерация, ловушки sqlc |
| [`backend/nats-contracts.md`](backend/nats-contracts.md) | Межсервисные контракты, владение, версии |
| [`backend/permissions.md`](backend/permissions.md) | Кто решает, что пользователю можно |
| [`backend/concurrency.md`](backend/concurrency.md) | Фоновые задачи, блокировки, гонки записи |
| [`backend/bootstrap-data.md`](backend/bootstrap-data.md) | Засев корневых данных и цикл зависимости прав |
| [`backend/testing.md`](backend/testing.md) | Что тестируется, чем и почему без моков |

## Frontend

| Документ | Тема |
|---|---|
| [`frontend/workspace.md`](frontend/workspace.md) | Workspace, catalog, границы пакетов |
| [`frontend/scss-bem.md`](frontend/scss-bem.md) | BEM, модификаторы-атрибуты, структура блока |
| [`frontend/design-tokens.md`](frontend/design-tokens.md) | Цвет, отступ, типографика, брейкпоинты |
| [`frontend/components-package.md`](frontend/components-package.md) | Устройство компонента, props, слоты, dist |
| [`frontend/composables.md`](frontend/composables.md) | Композаблы: правила, жизненный цикл, границы |
| [`frontend/storybook.md`](frontend/storybook.md) | Что должно быть историей и зачем |
| [`frontend/state-and-stores.md`](frontend/state-and-stores.md) | Pinia, стор против композабла |
| [`frontend/api-and-adapters.md`](frontend/api-and-adapters.md) | Контракты, адаптеры, переключение провайдера |
| [`frontend/eventual-consistency.md`](frontend/eventual-consistency.md) | Запись видна не сразу: оверлей и опрос |
| [`frontend/performance.md`](frontend/performance.md) | Загрузка, main thread, рендеринг, измерение бандла, lab и field |
| [`frontend/testing.md`](frontend/testing.md) | Ложное покрытие `.vue`, разделение окружений |
| [`frontend/nuxt-application.md`](frontend/nuxt-application.md) | Слои приложения, SSR, runtime config |

## Как пользоваться этими документами

При расхождении документа с кодом **прав код**. Порядок источников истины:

1. исполняемый код, конфигурация, миграции и тесты;
2. принятые ADR в [`decisions/`](decisions/);
3. эти документы и README компонентов;
4. память проекта.

Нашли расхождение — исправьте документ в том же изменении, что и код. Документ,
которому перестали доверять, хуже отсутствующего: его читают и делают неверно.
