# frontend

pnpm-workspace фронтенда.

```text
frontend/
├─ pnpm-workspace.yaml   пакеты + catalog версий
├─ tsconfig.base.json    общий strict-базис
├─ applications/
│  └─ web/               Nuxt-приложение (@starter/web)
└─ packages/
   ├─ components/        дизайн-система + Storybook (@starter/components)
   ├─ shared/            headless-состояние (@starter/shared)
   ├─ api/               транспорт и схемы (@starter/api)
   └─ eslint-config/     общие правила (@starter/eslint-config)
```

## Команды (из `frontend/`)

```bash
pnpm install          # один lock-файл на весь workspace
pnpm build:local      # shared -> api -> components
pnpm dev              # сборка пакетов + запуск web
pnpm storybook        # витрина дизайн-системы на :6006
pnpm lint
pnpm typecheck
pnpm test
```

Фильтр по пакету: `pnpm --filter @starter/web <script>`.

## Два правила, которые ломают больше всего времени

**1. Пакеты экспортируют `dist`, а не `src`.** Правка в `packages/*/src`
становится видимой потребителю только после сборки пакета. После чистой
установки и после удаления `node_modules` сначала `pnpm build:local`.

**2. Версия общей зависимости живёт в `catalog:`.** В манифесте пакета пишется
`"vue": "catalog:"`. Точная версия в отдельном пакете — это будущий второй
экземпляр Vue в бандле.

## Границы пакетов

| Пакет | Знает про | НЕ знает про |
|---|---|---|
| `components` | Vue, стили, токены | HTTP, роутер, домен |
| `shared` | Vue-реактивность | стили, компоненты, Nuxt |
| `api` | HTTP, форму JSON бэкенда | Vue, домен приложения |
| `web` | всё перечисленное | — |

Нарушение границы — это не стилистика: компонент, знающий про HTTP, нельзя
показать в Storybook, а `shared`, знающий про стили, нельзя переиспользовать во
втором приложении.

Подробнее — [`docs/frontend/workspace.md`](../docs/frontend/workspace.md).
