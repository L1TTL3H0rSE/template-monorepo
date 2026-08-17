import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, NetworkError } from "../src/core/index";

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
