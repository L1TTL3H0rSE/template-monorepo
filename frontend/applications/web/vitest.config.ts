import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Тесты приложения разделены по окружениям.
 *
 * `test/unit/**` — обычное Node-окружение: контракты, адаптеры, чистая логика.
 * Быстро, без Nuxt.
 *
 * `test/nuxt/**` — окружение Nuxt (`@nuxt/test-utils`, `mountSuspended`):
 * только то, чему действительно нужны авто-импорты, роутер и runtime config.
 *
 * Разделение обязательно, а не для порядка: Node-окружение НЕ видит
 * `app/pages/**` и `app/layouts/**`, поэтому эти каталоги исключены из
 * покрытия. Оставленные внутри, они дают ноль покрытия и обесценивают общую
 * цифру; покрывать их нужно тестами из `test/nuxt`, а не подгонкой отчёта.
 */
export default defineConfig({
  resolve: {
    // Тот же alias `~`, что и у Nuxt: тест импортирует приложение теми же
    // путями, что и рантайм.
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["test/unit/*.test.ts", "test/unit/**/*.test.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // См. комментарий в packages/components/vitest.config.ts: remapping
      // обязателен, иначе .vue-файлы показывают ложные 100%. С vitest 4 он
      // включён всегда и отдельной опции не имеет.

      include: ["app/**/*.{ts,vue}"],
      exclude: [
        "app/**/*.d.ts",
        // Не видны из Node-окружения — покрываются тестами test/nuxt.
        "app/pages/**",
        "app/layouts/**",
        "app/plugins/**",
        "app/app.vue",
        "app/error.vue",
      ],
    },
  },
});
