import { ApiError, NetworkError } from "./errors";

/** Конверт успешного ответа бэкенда (kit/ginx SuccessResponse). */
export type SuccessEnvelope<T> = {
  error: false;
  message?: string;
  data: T;
};

/** Конверт ответа с ошибкой (kit/ginx ErrorResponse). */
export type ErrorEnvelope = {
  error: true;
  message?: string;
  code?: string;
  details?: string;
};

export type TokenProvider = () => Promise<string | null> | string | null;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Единственный HTTP-транспорт фронтенда.
 *
 * Он владеет тем, что иначе дублируется в каждом вызове: базовый URL,
 * подстановка токена, разбор конверта `{error, data}` и превращение ответа с
 * ошибкой в типизированный `ApiError`.
 *
 * Клиент НЕ знает доменных типов. Их знают адаптеры: см.
 * docs/frontend/api-and-adapters.md.
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken?: TokenProvider,
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(
      path.replace(/^\//, ""),
      this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`,
    );

    for (const [key, value] of Object.entries(options.query ?? {})) {
      // Пустые параметры не отправляются: `?q=&page=` заставляет бэкенд
      // отличать «не передано» от «передано пустым» без причины.
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = await this.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (caught) {
      throw new NetworkError("Сервис недоступен", caught);
    }

    if (response.status === 204) return undefined as T;

    const payload = (await response.json().catch(() => null)) as
      SuccessEnvelope<T> | ErrorEnvelope | null;

    if (!response.ok || payload?.error) {
      const failure = (payload ?? {}) as ErrorEnvelope;
      throw new ApiError(
        response.status,
        failure.message ?? `HTTP ${response.status}`,
        failure.code,
        failure.details,
      );
    }

    // Разворачивание конверта — здесь и только здесь. Иначе каждый вызывающий
    // пишет `.data.data` и однажды ошибается.
    return (payload as SuccessEnvelope<T>).data;
  }

  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method">,
  ) {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method">,
  ) {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
