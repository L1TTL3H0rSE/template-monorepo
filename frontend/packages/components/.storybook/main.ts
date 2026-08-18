import type { StorybookConfig } from "@storybook/vue3-vite";

/**
 * Storybook читает те же vite.config.ts и SCSS API, что и сборка пакета.
 * Отдельной конфигурации сборки для историй не заводится: иначе компонент
 * выглядит в Storybook иначе, чем в приложении, и витрина перестаёт быть
 * доказательством.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-links"],
  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },
};

export default config;
