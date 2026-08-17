const LOCK_CLASS = "roleplay-layout-lock";

/** Счётчик блокировок: два открытых оверлея не должны разблокировать друг друга. */
let lockCount = 0;

/**
 * Блокирует прокрутку страницы под оверлеем.
 *
 * Класс вместо inline-стиля: значение видно в DevTools и переопределяется
 * темой, а не спрятано в атрибуте style.
 */
export function lockScroll(): void {
  if (typeof document === "undefined") return;

  lockCount += 1;
  if (lockCount === 1) {
    document.documentElement.classList.add(LOCK_CLASS);
    document.body.classList.add(LOCK_CLASS);
  }
}

/** Снимает блокировку, когда закрылся последний оверлей. */
export function unlockScroll(): void {
  if (typeof document === "undefined") return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.classList.remove(LOCK_CLASS);
    document.body.classList.remove(LOCK_CLASS);
  }
}
