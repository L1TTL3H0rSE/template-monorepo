/**
 * Вызывает обработчик, который может вернуть как значение, так и промис.
 *
 * Нужен там, где компонент показывает загрузку на время работы колбэка: без
 * этого каждый вызывающий проверяет `instanceof Promise` сам, и половина
 * забывает.
 */
export async function callMayBePromise<T>(
  fn: () => T | Promise<T>,
): Promise<T> {
  return await fn();
}

/**
 * Промис, который резолвится через указанное время.
 *
 * Только для UI-задержек (например, минимальное время показа скелетона).
 * Ожидание готовности данных делается подпиской, а не sleep.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
