import type { Plugin } from "vue";
import {
  componentsConfigKey,
  type ComponentsPluginOptions,
} from "./composables/useComponentsConfig";

/**
 * Плагин пакета: кладёт настройки в provide и помечает страницу отпечатком
 * сборки.
 *
 * `data-roleplay-components-build` в DOM позволяет отличить «ошибка в текущем
 * коде» от «потребитель загрузил старый бандл» — сравните значение в браузере
 * с `dist/.build-hash`. Без этого маркера отладка stale-сборки в Docker
 * превращается в угадывание.
 */
export const componentsPlugin: Plugin<[options?: ComponentsPluginOptions]> = {
  install(app, options = {}) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.roleplayComponentsBuild =
        __ROLEPLAY_COMPONENTS_BUILD__;
    }

    app.provide(componentsConfigKey, options);
  },
};

export type { ComponentsPluginOptions } from "./composables/useComponentsConfig";
