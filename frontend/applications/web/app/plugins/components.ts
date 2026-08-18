import { NuxtLink } from "#components";
import { componentsPlugin } from "@starter/components";

/**
 * Установка дизайн-системы — задача плагина, а не компонента.
 *
 * Плагин выполняется один раз при инициализации приложения и до первого
 * рендера; в `app.vue` та же установка выполнялась бы в setup корневого
 * компонента, то есть уже после того, как Vue начал разрешать дерево.
 *
 * Здесь же приложение передаёт пакету то, чего пакет не должен знать сам:
 * компонент ссылки конкретного роутера. Благодаря этому `@starter/components`
 * не зависит от Nuxt и остаётся собираемым для Storybook.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(componentsPlugin, { linkComponent: NuxtLink });
});
