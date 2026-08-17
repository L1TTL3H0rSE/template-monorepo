import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

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

        // Ключевая строка. Провайдер v8 считает покрытие по инструментированному
        // выводу, а не по исходнику. Для .vue это означает, что файл, который
        // просто ИМПОРТИРОВАЛИ, но ни разу не отрендерили, показывает 100%
        // покрытия: тело setup и шаблон в отчёт не попадают.
        //
        // Метрика при этом не просто завышена — она обратна смыслу: чем больше
        // компонентов импортирует барель, тем «лучше» покрытие. Без этой строки
        // цифры покрытия для Vue-проекта нельзя использовать ни в ревью, ни в
        // quality gate.
        experimentalAstAwareRemapping: true,

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
