import { effectScope, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchQuery } from "../src/search/useSearchQuery";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Композабл вешает watch и таймер, поэтому тест запускает его внутри
 * effectScope — как это делает Vue в компоненте. Без scope onScopeDispose не
 * сработал бы, и тест не проверял бы главное: снятие таймера.
 */
function withScope<T>(fn: () => T): { value: T; stop: () => void } {
  const scope = effectScope();
  const value = scope.run(fn) as T;

  return { value, stop: () => scope.stop() };
}

describe("useSearchQuery", () => {
  it("применяет ввод только после задержки", async () => {
    const { value: search, stop } = withScope(() =>
      useSearchQuery({ debounceMs: 300 }),
    );

    search.raw.value = "эйра";
    await nextTick();

    expect(search.applied.value).toBe("");

    vi.advanceTimersByTime(300);

    expect(search.applied.value).toBe("эйра");
    stop();
  });

  it("игнорирует ввод короче minLength", async () => {
    const { value: search, stop } = withScope(() =>
      useSearchQuery({ minLength: 3 }),
    );

    search.raw.value = "эй";
    await nextTick();
    vi.advanceTimersByTime(1000);

    expect(search.applied.value).toBe("");
    stop();
  });

  // Сброс фильтра не должен ждать debounce: пользователь очистил поле и ждёт
  // полный список сразу.
  it("применяет пустой запрос немедленно", async () => {
    const { value: search, stop } = withScope(() => useSearchQuery());

    search.raw.value = "эйра";
    await nextTick();
    vi.advanceTimersByTime(300);

    search.raw.value = "";
    await nextTick();

    expect(search.applied.value).toBe("");
    stop();
  });

  // Регрессия: отложенный вызов после ухода со страницы пишет в мёртвый scope.
  it("снимает таймер при остановке scope", async () => {
    const { value: search, stop } = withScope(() => useSearchQuery());

    search.raw.value = "эйра";
    await nextTick();
    stop();
    vi.advanceTimersByTime(1000);

    expect(search.applied.value).toBe("");
  });
});
