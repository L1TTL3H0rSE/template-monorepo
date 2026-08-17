// Публичная поверхность пакета.
//
// Всё, чего здесь нет, приложением не импортируется: это позволяет менять
// внутренние файлы, не ломая потребителей. Новый экспорт добавляется осознанно
// и проверяется тестом test/public-surface.test.ts.
import "./assets/scss/global.scss";

export * from "./components/index";

// composables
export * from "./composables/useComponentsConfig";
export * from "./composables/useCustomBreakpoints";
export * from "./composables/useDisclosure";
export * from "./composables/useMappedModel";

// stores
export * from "./stores/modals";

// utils
export * from "./utils/_breakpoints";
export * from "./utils/browser";
export * from "./utils/dom";
export * from "./utils/promises";

// plugin
export * from "./plugin";
