import storybook from "eslint-plugin-storybook";
import vueConfig from "./vue.js";

/**
 * Конфигурация для пакета с историями Storybook.
 */
export default [
  ...vueConfig,
  ...storybook.configs["flat/recommended"],
  {
    files: ["**/*.stories.ts"],
    rules: {
      // История — это данные, а не продакшен-код: явные литералы читаются
      // лучше, чем вынесенные константы.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
