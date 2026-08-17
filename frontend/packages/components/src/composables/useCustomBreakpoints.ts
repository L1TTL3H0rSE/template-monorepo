import { computed, onBeforeUnmount, ref, type ComputedRef } from "vue";
import { breakpoints, type BreakpointName } from "../utils/_breakpoints";
import { isBrowser } from "../utils/browser";

export type BreakpointState = {
  /** Текущая ширина окна; 0 на сервере. */
  width: ComputedRef<number>;
  /** Ширина <= указанного брейкпоинта. */
  smallerOrEqual: (name: BreakpointName) => ComputedRef<boolean>;
  /** Ширина > указанного брейкпоинта. */
  greater: (name: BreakpointName) => ComputedRef<boolean>;
  isMobile: ComputedRef<boolean>;
  isTablet: ComputedRef<boolean>;
  isDesktop: ComputedRef<boolean>;
};

/**
 * Реактивные брейкпоинты из того же источника, что и SCSS-переменные
 * (`src/breakpoints.json`).
 *
 * Слушатель снимается через onBeforeUnmount: композабл, который вешает
 * глобальный обработчик и не убирает его, течёт при каждом переходе по
 * страницам.
 */
export function useCustomBreakpoints(): BreakpointState {
  const windowWidth = ref(isBrowser ? window.innerWidth : 0);

  if (isBrowser) {
    const onResize = () => {
      windowWidth.value = window.innerWidth;
    };
    window.addEventListener("resize", onResize, { passive: true });
    onBeforeUnmount(() => window.removeEventListener("resize", onResize));
  }

  const width = computed(() => windowWidth.value);

  const smallerOrEqual = (name: BreakpointName) =>
    computed(() => windowWidth.value <= breakpoints[name]);
  const greater = (name: BreakpointName) =>
    computed(() => windowWidth.value > breakpoints[name]);

  return {
    width,
    smallerOrEqual,
    greater,
    isMobile: smallerOrEqual("tablet"),
    isTablet: computed(
      () =>
        windowWidth.value > breakpoints.tablet &&
        windowWidth.value <= breakpoints.tablet_large,
    ),
    isDesktop: greater("tablet_large"),
  };
}
