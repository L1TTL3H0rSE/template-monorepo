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

/** Ошибка сети или прерывания: ответа от сервера не было вообще. */
export class NetworkError extends Error {
  constructor(message: string, cause?: unknown) {
    // cause передаётся штатным полем Error, а не собственным свойством:
    // объявление своего `cause` перекрыло бы поле базового класса.
    super(message, { cause });
    this.name = "NetworkError";
  }
}
