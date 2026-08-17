import { describe, expect, it, vi } from "vitest";
import { probeUntil } from "../src/data/probeUntil";

describe("probeUntil", () => {
  it("возвращает true на первой успешной проверке", async () => {
    const check = vi.fn(async () => true);

    const result = await probeUntil(check, { initialDelayMs: 0 });

    expect(result).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("повторяет, пока условие не выполнится", async () => {
    let calls = 0;
    const check = async () => ++calls >= 3;

    const result = await probeUntil(check, { initialDelayMs: 0, attempts: 5 });

    expect(result).toBe(true);
    expect(calls).toBe(3);
  });

  // Бюджет обязателен: бесконечный retry превращает временную деградацию
  // конвейера в шторм запросов от каждой открытой вкладки.
  it("исчерпывает бюджет и возвращает false", async () => {
    const check = vi.fn(async () => false);

    const result = await probeUntil(check, { initialDelayMs: 0, attempts: 4 });

    expect(result).toBe(false);
    expect(check).toHaveBeenCalledTimes(4);
  });

  // Сбой одной попытки не должен прекращать опрос: сервис мог быть недоступен
  // ровно на время этого запроса.
  it("продолжает опрос после ошибки проверки", async () => {
    let calls = 0;
    const check = async () => {
      calls++;
      if (calls === 1) throw new Error("network");
      return calls >= 2;
    };

    const result = await probeUntil(check, { initialDelayMs: 0 });

    expect(result).toBe(true);
    expect(calls).toBe(2);
  });

  it("прерывается по сигналу", async () => {
    const controller = new AbortController();
    const check = vi.fn(async () => false);

    const pending = probeUntil(check, {
      initialDelayMs: 5,
      attempts: 10,
      signal: controller.signal,
    });
    controller.abort();

    expect(await pending).toBe(false);
    expect(check.mock.calls.length).toBeLessThan(10);
  });

  it("увеличивает задержку с потолком", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", ((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      return originalSetTimeout(fn, 0);
    }) as typeof setTimeout);

    await probeUntil(async () => false, {
      attempts: 5,
      initialDelayMs: 100,
      factor: 3,
      maxDelayMs: 500,
    });

    vi.unstubAllGlobals();
    // Четыре ожидания между пятью попытками; рост 100 -> 300 -> 500 (потолок).
    expect(delays).toEqual([100, 300, 500, 500]);
  });
});
