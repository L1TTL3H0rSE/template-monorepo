# @starter/web

Nuxt-приложение проекта.

## Слои

```text
app/pages/        экраны и маршруты
app/layouts/      каркас страницы
app/components/   компоненты, специфичные для этого приложения
app/composables/  состояние экрана (форма, фильтр)
app/stores/       состояние, переживающее экран (список, сессия)
app/api/          выбор реализации порта
app/adapters/     реализации порта: http/ и mock/
app/contracts/    доменные типы и интерфейсы портов
```

Направление зависимостей всегда одно:

```text
pages -> stores/composables -> contracts <- adapters <- @starter/api
```

`contracts` не зависит ни от чего. Компоненты никогда не импортируют
`@starter/api` напрямую.

## Команды

```bash
pnpm dev        # http://localhost:3000
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Перед первым запуском собери локальные пакеты из `frontend/`:

```bash
pnpm build:local
```

Пакеты экспортируют `dist`, поэтому без сборки приложение увидит пустые
модули.

## Переключение провайдера данных

```bash
NUXT_PUBLIC_API_PROVIDER=mock   # фикстуры, бэкенд не нужен (по умолчанию)
NUXT_PUBLIC_API_PROVIDER=http   # реальный бэкенд
NUXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

Выбор делается в `app/api/api.ts` — единственном месте, где вообще встречается
слово «mock». Страницы и сторы знают только тип порта.

Подробности — [`docs/frontend/nuxt-application.md`](../../../docs/frontend/nuxt-application.md).
