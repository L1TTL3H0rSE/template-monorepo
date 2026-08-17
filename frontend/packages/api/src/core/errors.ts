/**
 * Ошибка HTTP-транспорта.
 *
 * Отдельный класс, а не голый Error, нужен по одной причине: интерфейсу нужно
 * различать 404 (показать «не найдено»), 401 (отправить на вход) и 500
 * (показать «попробуйте позже»). Со строкой в message это делается сравнением
 * текста, который меняется при первой же правке бэкенда.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isServer(): boolean {
    return this.status >= 500;
  }
}

/** Ошибка сети: ответа от сервера не было вообще. */
export class NetworkError extends Error {
  constructor(message: string, cause?: unknown) {
    // cause передаётся штатным полем Error, а не собственным свойством:
    // объявление своего `cause` перекрыло бы поле базового класса.
    super(message, { cause });
    this.name = "NetworkError";
  }
}

/**
 * Запрос отменён вызывающим.
 *
 * Отдельный тип, а не `NetworkError`, по одной причине: отмена — это
 * НОРМАЛЬНЫЙ исход, а не отказ. Интерактивный поиск отменяет предыдущее чтение
 * на каждом нажатии клавиши; если отмена приходит как ошибка сети,
 * пользователь видит «Сервис недоступен» при обычном наборе текста.
 *
 * Вызывающий обязан отличать эти два случая, а различить их по тексту
 * сообщения нельзя.
 */
export class RequestCancelledError extends Error {
  constructor(cause?: unknown) {
    super("Запрос отменён", { cause });
    this.name = "RequestCancelledError";
  }
}

/**
 * Распознаёт отмену.
 *
 * Проверяются оба признака: `AbortError` от fetch и состояние сигнала. В гонке
 * между отменой и сетевым сбоем сработать может любой из них, и полагаться на
 * один — значит иногда показать пользователю ложную ошибку.
 */
export function isAbort(caught: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (caught instanceof RequestCancelledError) return true;

  return (
    typeof caught === "object" &&
    caught !== null &&
    "name" in caught &&
    (caught as { name?: unknown }).name === "AbortError"
  );
}

/** Была ли операция отменена, а не завершилась ошибкой. */
export function isCancelled(caught: unknown): boolean {
  return caught instanceof RequestCancelledError || isAbort(caught);
}
