import { inject, type Component, type InjectionKey } from "vue";

/**
 * Настройки пакета, которые приложение задаёт один раз при установке плагина.
 *
 * Пакет не знает про роутер приложения: компонент ссылки приходит снаружи.
 * Иначе `@starter/components` пришлось бы собирать отдельно под Nuxt, под
 * Storybook и под любой третий контекст.
 */
export type ComponentsPluginOptions = {
  /** Компонент ссылки (NuxtLink, RouterLink или обычный `a`). */
  linkComponent?: Component;
  /** Базовый URL хранилища изображений для относительных путей. */
  assetsBaseUrl?: string;
};

export const componentsConfigKey: InjectionKey<ComponentsPluginOptions> =
  Symbol("starter-components-config");

const fallbackConfig: ComponentsPluginOptions = {};

/**
 * Читает настройки пакета.
 *
 * Возвращает пустой объект, если плагин не установлен: компонент обязан
 * работать в Storybook и в тестах без обвязки приложения.
 */
export function useComponentsConfig(): ComponentsPluginOptions {
  return inject(componentsConfigKey, fallbackConfig);
}
