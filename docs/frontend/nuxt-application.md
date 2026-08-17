# Nuxt-приложение

## Слои

```text
app/pages/        экраны и маршруты: отображение и события
app/layouts/      каркас страницы
app/components/   компоненты, специфичные для этого приложения
app/composables/  состояние экрана (форма, фильтр)
app/stores/       состояние, переживающее экран
app/plugins/      инициализация приложения
app/api/          выбор реализации порта
app/adapters/     реализации порта: http/ и mock/
app/contracts/    доменные типы и интерфейсы портов
```

Направление зависимостей всегда одно:

```text
pages -> stores/composables -> contracts <- adapters <- @roleplay/api
```

`contracts` не зависит ни от чего. Компоненты **никогда** не импортируют
`@roleplay/api` напрямую.

## `app/components` против `packages/components`

| Признак | Куда |
|---|---|
| Знает про домен (`Character`, `Campaign`) | `app/components` |
| Ходит в стор приложения | `app/components` |
| Только props и слоты, никакого домена | `packages/components` |
| Понадобится второму приложению | `packages/components` |

Компонент, знающий про домен, нельзя показать в Storybook без фикстур домена —
и он там не нужен.

## Плагин вместо инициализации в `app.vue`

```ts
// app/plugins/components.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(componentsPlugin, { linkComponent: NuxtLink });
});
```

Плагин выполняется один раз при инициализации приложения и **до** первого
рендера. Та же установка в setup корневого компонента произошла бы после того,
как Vue начал разрешать дерево.

Здесь же приложение передаёт пакету то, чего пакет не должен знать сам:
компонент ссылки конкретного роутера. Благодаря этому `@roleplay/components` не
зависит от Nuxt.

## Runtime config

```ts
runtimeConfig: {
  public: {
    apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || "/api/v1",
    apiProvider: process.env.NUXT_PUBLIC_API_PROVIDER || "mock",
  },
}
```

`process.env` читается явно: Nuxt не применяет env-оверрайды к вложенным ключам
достаточно надёжно, чтобы на это полагаться. Fallback обязателен — приложение
должно подниматься без единой переменной.

В `public` попадает только то, что **можно показать пользователю**: содержимое
запекается в клиентский бандл. Секрет, положенный в `public`, — это
опубликованный секрет.

## SCSS API

```ts
vite: {
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@roleplay/components/scss/api.scss" as *;`,
      },
    },
  },
}
```

Тот же SCSS API, что и в пакете компонентов: `typography()`, `$breakpoint-*` и
`focus-ring()` доступны в любом SFC без импорта. Без этой строки каждый файл
стилей обязан импортировать api сам — и половина забывает, получая
`Undefined mixin`.

## SSR

По умолчанию Nuxt рендерит на сервере. Практические следствия:

**Нет `window` и `document` на сервере.** Обращение без проверки роняет рендер:

```ts
if (typeof window === "undefined") return;
```

**Запрос, требующий пользовательского токена, не делается в setup:**

```ts
// Первая загрузка через onMounted: на сервере токена пользователя нет.
onMounted(() => void store.load());
```

**Данные, не зависящие от пользователя, наоборот, стоит грузить на сервере** —
через `useAsyncData`: страница приходит заполненной и индексируется.

## Стили страниц — `scoped`

```vue
<style lang="scss" scoped>
.characters { /* ... */ }
</style>
```

`scoped` в приложении, **не** `scoped` в пакете компонентов. Стиль страницы не
должен протекать в дизайн-систему; стиль компонента библиотеки обязан быть
переопределяемым потребителем.

## Страница ошибки

`app/error.vue` показывает статус и общую формулировку. Текст внутренней ошибки
наружу не выводится: он адресован разработчику и часто содержит детали
инфраструктуры.

## Auto-import

Nuxt авто-импортирует `ref`, `computed`, `useRoute`, содержимое
`app/composables` и `app/components`. Поэтому:

- в конфигурации ESLint отключён `no-undef` — типы приходят из `.nuxt/`, а не из
  импортов;
- пакеты из workspace (`@roleplay/components`) импортируются **явно**: они не
  входят в авто-импорт Nuxt.

## Локальные пакеты нужно собрать

```bash
pnpm build:local        # из frontend/
pnpm --filter @roleplay/web dev
```

Пакеты экспортируют `dist`, поэтому без сборки приложение увидит пустые модули.
Это самая частая ошибка первого запуска после клонирования.

## Команды

```bash
pnpm dev          # http://localhost:3000
pnpm build
pnpm typecheck    # nuxt typecheck — обязателен, ловит ловушки reactive
pnpm test
pnpm lint
```
