import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import prettierOptions from "./shared/prettier.js";

/**
 * База для Vue-пакетов. Приложения Nuxt расширяют её через ./nuxt.js.
 *
 * Правила подобраны так, чтобы фиксировать договорённости, а не вкусы:
 * порядок блоков в SFC, запрет any, обязательный порядок атрибутов.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.nuxt/**",
      "**/.output/**",
      "**/storybook-static/**",
      "**/node_modules/**",
      "**/*.gen.ts",
      "**/auto-imports.d.ts",
      "**/components/index.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: [".vue"] },
    },
  },
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": ["error", prettierOptions],

      // no-undef выключен намеренно: в TypeScript эту работу делает
      // компилятор, причём корректно — он знает про lib.dom, про глобальные
      // типы из .d.ts и про авто-импорты. ESLint их не видит и ругается на
      // window, console и MouseEvent в заведомо рабочем коде.
      "no-undef": "off",

      // script setup сверху, template в середине, style внизу: одинаковый
      // порядок делает диффы читаемыми.
      "vue/block-order": [
        "error",
        { order: ["script", "template", "style"] },
      ],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettierConfig,
);
