import { describe, expect, it } from "vitest";
import * as componentsApi from "../src/components/index";
import * as publicApi from "../src/index";

/**
 * Reviewed allowlist публичной поверхности пакета.
 *
 * Тест падает в обе стороны: и когда экспорт исчез (ломая потребителей), и
 * когда появился незаявленный. Второе важнее — внутренний хелпер, случайно
 * попавший в барель, становится публичным API, которое потом никто не решается
 * убрать.
 *
 * Компоненты в список НЕ переписываются: их барель генерируется из каталога
 * (`scripts/generate-component-index.mjs`), и второй рукописный список означал
 * бы, что добавление компонента правит два файла ради одного факта — а
 * разойдутся они на первом же, где про второй файл забыли. Проверяется то, чего
 * генератор не покрывает: НЕкомпонентная часть поверхности.
 */
const ALLOWED_NON_COMPONENT_EXPORTS = [
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

describe("публичная поверхность @starter/components", () => {
  it("не содержит ничего, кроме компонентов и reviewed allowlist", () => {
    const componentNames = new Set(Object.keys(componentsApi));
    const actual = Object.keys(publicApi)
      .filter((name) => !componentNames.has(name))
      .sort();

    expect(actual).toEqual(ALLOWED_NON_COMPONENT_EXPORTS);
  });

  it("экспортирует все компоненты каталога", () => {
    for (const name of Object.keys(componentsApi)) {
      expect(publicApi).toHaveProperty(name);
    }
  });

  // Иначе проверка выше зелена ни на чём: пустой каталог прошёл бы её молча,
  // и исчезновение всей генерации выглядело бы как успех.
  it("каталог компонентов не пуст", () => {
    expect(Object.keys(componentsApi).length).toBeGreaterThan(0);
  });
});
