import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClient,
  ApiError,
  isCancelled,
  NetworkError,
  RequestCancelledError,
} from "../src/core/index";

function mockFetch(response: {
  status?: number;
  body?: unknown;
  reject?: unknown;
}) {
  const spy = vi.fn(async () => {
    if (response.reject) throw response.reject;

    return {
      ok: (response.status ?? 200) < 400,
      status: response.status ?? 200,
      json: async () => response.body,
    } as Response;
  });

  vi.stubGlobal("fetch", spy);

  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("ApiClient", () => {
  it("разворачивает конверт и возвращает data", async () => {
    mockFetch({ body: { error: false, data: { id: "1" } } });
    const client = new ApiClient("https://api.test/api/v1");

    const result = await client.get<{ id: string }>("example");

    expect(result).toEqual({ id: "1" });
  });

  it("не отправляет пустые query-параметры", async () => {
    const spy = mockFetch({ body: { error: false, data: null } });
    const client = new ApiClient("https://api.test/api/v1");

    await client.get("example", { query: { q: "", from: 0, size: 20 } });

    const url = spy.mock.calls[0]![0] as URL;
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.get("size")).toBe("20");
  });

  // Базовый путь не должен теряться: без завершающего слэша конструктор URL
  // отбрасывает последний сегмент, и запрос уходит на /example вместо
  // /api/v1/example.
  it("сохраняет базовый путь без завершающего слэша", async () => {
    const spy = mockFetch({ body: { error: false, data: null } });
    const client = new ApiClient("https://api.test/api/v1");

    await client.get("example/42");

    expect(String(spy.mock.calls[0]![0])).toBe(
      "https://api.test/api/v1/example/42",
    );
  });

  it("превращает ответ с ошибкой в типизированный ApiError", async () => {
    mockFetch({
      status: 404,
      body: { error: true, message: "Not found", code: "NOT_FOUND" },
    });
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client.get("example/42").catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).isNotFound).toBe(true);
    expect((failure as ApiError).code).toBe("NOT_FOUND");
  });

  it("отличает сетевой сбой от ответа сервера", async () => {
    mockFetch({ reject: new TypeError("failed to fetch") });
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client.get("example").catch((error) => error);

    expect(failure).toBeInstanceOf(NetworkError);
  });

  it("подставляет токен, когда провайдер его отдаёт", async () => {
    const spy = mockFetch({ body: { error: false, data: null } });
    const client = new ApiClient("https://api.test/api/v1", () => "token-123");

    await client.get("example");

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-123",
    );
  });

  it("не подставляет заголовок, когда токена нет", async () => {
    const spy = mockFetch({ body: { error: false, data: null } });
    const client = new ApiClient("https://api.test/api/v1", () => null);

    await client.get("example");

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("возвращает undefined на 204 без разбора тела", async () => {
    mockFetch({ status: 204, body: undefined });
    const client = new ApiClient("https://api.test/api/v1");

    await expect(client.delete("example/42")).resolves.toBeUndefined();
  });
});

/**
 * Отмена — нормальный исход интерактивного чтения, а не отказ сервиса.
 *
 * Если она приходит как NetworkError, обычный набор текста в поиске мигает
 * сообщением «Сервис недоступен»: каждый следующий символ отменяет предыдущий
 * запрос.
 */
describe("ApiClient: отмена", () => {
  it("AbortError от fetch не становится NetworkError", async () => {
    mockFetch({
      reject: Object.assign(new Error("aborted"), { name: "AbortError" }),
    });
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client.get("example").catch((error) => error);

    expect(failure).toBeInstanceOf(RequestCancelledError);
    expect(failure).not.toBeInstanceOf(NetworkError);
    expect(isCancelled(failure)).toBe(true);
  });

  it("отменённый сигнал распознаётся, даже если fetch отверг иначе", async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch({ reject: new TypeError("failed to fetch") });
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client
      .get("example", { signal: controller.signal })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(RequestCancelledError);
  });

  // Гонка: тело начало приходить, отмена случилась после ответа fetch, но до
  // разбора. Показывать это как отказ сервиса тоже нельзя.
  it("отмена после успешного ответа не отдаёт данные", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        return {
          ok: true,
          status: 200,
          json: async () => ({ error: false, data: { id: "1" } }),
        } as Response;
      }),
    );
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client
      .get("example", { signal: controller.signal })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(RequestCancelledError);
  });

  // Гонка на ЧТЕНИИ ТЕЛА: заголовки пришли, поток ещё качается, отмена
  // происходит во время json(). Без явного перехвата AbortError превратился бы
  // в пустой payload, и на статусе 200 код упал бы TypeError на `payload.data`.
  it("отмена во время чтения тела не превращается в TypeError", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          controller.abort();
          throw Object.assign(new Error("aborted"), { name: "AbortError" });
        },
      })) as unknown as typeof fetch,
    );
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client
      .get("example", { signal: controller.signal })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(RequestCancelledError);
    expect(failure).not.toBeInstanceOf(TypeError);
  });

  // Обратная сторона: невалидный JSON — не отмена, а ошибка сервера.
  it("битое тело при 500 остаётся ApiError, а не отменой", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      })) as unknown as typeof fetch,
    );
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client.get("example").catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(500);
  });

  // Обратная сторона: изменение не должно замаскировать настоящий сбой сети.
  it("настоящий сетевой сбой остаётся NetworkError", async () => {
    mockFetch({ reject: new TypeError("failed to fetch") });
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client.get("example").catch((error) => error);

    expect(failure).toBeInstanceOf(NetworkError);
    expect(isCancelled(failure)).toBe(false);
  });

  it("ошибка сервера остаётся ApiError при живом сигнале", async () => {
    const controller = new AbortController();
    mockFetch({ status: 500, body: { error: true, message: "boom" } });
    const client = new ApiClient("https://api.test/api/v1");

    const failure = await client
      .get("example", { signal: controller.signal })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).isServer).toBe(true);
  });
});
