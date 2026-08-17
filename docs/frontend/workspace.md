# Workspace фронтенда

```text
frontend/
├─ pnpm-workspace.yaml   пакеты + catalog версий
├─ pnpm-lock.yaml        ОДИН lock-файл на весь workspace
├─ tsconfig.base.json    общий strict-базис
├─ applications/
│  └─ web/               @roleplay/web
└─ packages/
   ├─ components/        @roleplay/components
   ├─ shared/            @roleplay/shared
   ├─ api/               @roleplay/api
   └─ eslint-config/     @roleplay/eslint-config
```

## Границы пакетов

| Пакет | Знает про | НЕ знает про |
|---|---|---|
| `components` | Vue, стили, токены | HTTP, роутер, домен |
| `shared` | Vue-реактивность | стили, компоненты, Nuxt |
| `api` | HTTP, форму JSON бэкенда | Vue, домен приложения |
| `eslint-config` | правила | ничего |
| `web` | всё перечисленное | — |

Нарушение границы — не стилистика. Каждая запрещённая стрелка стоит конкретной
возможности:

| Нарушение | Что теряется |
|---|---|
| `components` → `api` | Компонент нельзя показать в Storybook без бэкенда |
| `shared` → `components` | Состояние нельзя переиспользовать во втором приложении |
| `api` → `vue` | API нельзя вызвать из скрипта, теста или SSR |

## Catalog

```yaml
catalog:
  vue: ^3.5.18
  pinia: ^3.0.3
```

```json
{ "dependencies": { "vue": "catalog:" } }
```

**Почему обязательно.** Vue, установленный в двух версиях, даёт два экземпляра
рантайма: `provide` из одного не виден `inject` из другого. Симптом —
«инъекция не работает», причина — дерево зависимостей. На поиск уходят часы.

Catalog делает такую ситуацию невозможной: версия записана один раз, обновление
— одна правка.

Внутренние зависимости — через `workspace:*`:

```json
{ "dependencies": { "@roleplay/components": "workspace:*" } }
```

Один lock-файл: `frontend/pnpm-lock.yaml`. Вложенные lock-файлы в пакетах не
создаются — они дают тот самый второй экземпляр Vue.

## Пакеты экспортируют `dist`

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
}
```

Отсюда главное правило workspace:

> Правка в `packages/*/src` **не видна** потребителю, пока пакет не собран.

```bash
pnpm build:local   # shared -> api -> components, в порядке зависимостей
```

Порядок в `build:local` не произволен: `components` зависит от типов, которые
собирает `shared`. Новый пакет добавляется в эту цепочку **в правильном месте**,
иначе сборка проходит на тёплом кеше и падает на чистом.

## Точки входа по подпутям

```json
"exports": {
  ".":       "./dist/index.js",
  "./data":  "./dist/data/index.js",
  "./forms": "./dist/forms/index.js"
}
```

Приложение, которому нужна только форма, не тянет в бандл всё остальное. Один
общий барель на большой пакет — это гарантированный лишний вес.

## Общий tsconfig

`tsconfig.base.json` включает `strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`. Пакеты его расширяют.

`noUncheckedIndexedAccess` заметно строже привычного: `array[0]` имеет тип
`T | undefined`. Это неудобно ровно до первого падения на пустом массиве в
проде.

## Добавление пакета

1. Каталог в `packages/<имя>`.
2. `package.json` с `"name": "@roleplay/<имя>"` и `exports` на `dist`.
3. `tsconfig.json`, расширяющий `../../tsconfig.base.json`.
4. `eslint.config.mjs`, реэкспортирующий общий конфиг.
5. Зависимость `"@roleplay/<имя>": "workspace:*"` у потребителя.
6. `pnpm install`.
7. Пакет в цепочку `build:local`, если от него зависят другие.
8. `README.md`: что внутри и чего внутри быть не должно.

Пункт 8 не формальность: граница, не записанная словами, размывается за месяц.

## Команды

```bash
pnpm install
pnpm build:local
pnpm dev                  # сборка пакетов + запуск web
pnpm storybook
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @roleplay/web <script>
```
