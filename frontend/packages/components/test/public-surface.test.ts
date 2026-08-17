import { describe, expect, it } from "vitest";
import * as publicApi from "../src/index";

/**
 * Reviewed allowlist публичной поверхности пакета.
 *
 * Тест падает в обе стороны: и когда экспорт исчез (ломая потребителей), и
 * когда появился незаявленный. Второе важнее — внутренний хелпер, случайно
 * попавший в барель, становится публичным API, которое потом никто не решается
 * убрать.
 */
const ALLOWED_EXPORTS = [
  // компоненты
  "Avatar",
  "Badge",
  "Button",
  "Card",
  "Modal",
  "TextField",
  // composables
  "componentsConfigKey",
  "useComponentsConfig",
  "useCustomBreakpoints",
  "useDisclosure",
  "useMappedModel",
  // stores
  "useModalsStore",
  // utils
  "breakpoints",
  "isBrowser",
  "secureRandomUint32",
  "lockScroll",
  "unlockScroll",
  "callMayBePromise",
  "sleep",
  // plugin
  "componentsPlugin",
].sort();

describe("публичная поверхность @roleplay/components", () => {
  it("совпадает с reviewed allowlist", () => {
    const actual = Object.keys(publicApi).sort();

    expect(actual).toEqual(ALLOWED_EXPORTS);
  });
});
