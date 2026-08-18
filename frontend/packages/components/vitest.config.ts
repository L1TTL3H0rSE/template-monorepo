import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Конфигурация тестов наследует resolve/css/plugins от сборки: тест должен
// видеть тот же alias `@` и тот же SCSS API, что и продакшен-сборка. Иначе
// «работает в тестах, падает в сборке» становится штатной ситуацией.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      include: ["test/**/*.test.ts", "src/**/*.test.ts"],

      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],

        // AST-aware remapping в vitest 4 включён всегда и отдельной опции не
        // имеет (в 3.x это был `experimentalAstAwareRemapping: true`). Он здесь
        // критичен: без него провайдер v8 считает покрытие по
        // инструментированному выводу, и файл .vue, который просто
        // ИМПОРТИРОВАЛИ, но ни разу не отрендерили, показывает 100% —
        // метрика становится обратна смыслу, потому что чем больше компонентов
        // тянет барель, тем «лучше» покрытие. Проверяется тестом ниже по
        // отчёту, а не на веру.

        include: ["src/**/*.{ts,vue}"],
        exclude: [
          "src/**/*.stories.ts",
          "src/**/*.d.ts",
          "src/**/index.ts",
          // Сгенерированные файлы: покрывать нечего, а их 100% размывает
          // реальную картину.
          "src/utils/_breakpoints.ts",
          "src/components/index.ts",
        ],
      },
    },
  }),
);
