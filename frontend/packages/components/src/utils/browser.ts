/**
 * Выполняется ли код в браузере.
 *
 * Nuxt рендерит те же компоненты на сервере, где нет window: обращение к нему
 * без проверки роняет SSR.
 */
export const isBrowser = typeof window !== "undefined";

/**
 * Криптостойкое случайное 32-битное число.
 *
 * Math.random() не используется даже для ключей списка: линтеры безопасности
 * помечают каждое его вхождение, и разбор «здесь можно, там нельзя» стоит
 * дороже одной функции.
 */
export function secureRandomUint32(): number {
  if (isBrowser && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }

  return 0;
}
