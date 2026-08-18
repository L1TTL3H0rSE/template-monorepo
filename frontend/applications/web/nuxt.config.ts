export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["@pinia/nuxt", "@vueuse/nuxt"],

  css: ["@starter/components/styles"],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // Тот же SCSS API, что и в пакете компонентов: миксин typography(),
          // $breakpoint-* и focus-ring доступны в любом SFC приложения без
          // импорта. Без этой строки приложение вынуждено импортировать api в
          // каждом блоке стилей — и половина файлов забывает.
          additionalData: `@use "@starter/components/scss/api.scss" as *;`,
        },
      },
    },
  },

  app: {
    head: {
      title: "Starter",
      meta: [
        {
          name: "description",
          content: "Площадка для текстовых ролевых игр.",
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // Значения деплой-специфичны, поэтому читаются из env на сборке.
      // process.env читается явно: Nuxt не применяет env-оверрайды к вложенным
      // ключам достаточно надёжно, чтобы на это полагаться.
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || "/api/v1",

      // Провайдер данных: "http" — реальный бэкенд, "mock" — встроенные
      // фикстуры. Переключатель существует не для удобства, а чтобы фронтенд
      // разрабатывался и тестировался без поднятого бэкенда, а контракт при
      // этом оставался один — см. app/contracts.
      apiProvider: process.env.NUXT_PUBLIC_API_PROVIDER || "mock",
    },
  },

  typescript: {
    typeCheck: false,
    strict: true,
  },
});
