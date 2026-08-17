import { describe, expect, it } from "vitest";
import { useAsyncState } from "../src/data/useAsyncState";

describe("useAsyncState", () => {
  it("снимает pending после ошибки", async () => {
    const state = useAsyncState(async () => {
      throw new Error("boom");
    });

    await state.execute();

    // Вечный скелетон при неудачном запросе — самая частая ошибка ручной
    // реализации: pending снимается только в успешной ветке.
    expect(state.pending.value).toBe(false);
    expect(state.error.value).toBeInstanceOf(Error);
  });

  it("сбрасывает прошлую ошибку при повторе", async () => {
    let shouldFail = true;
    const state = useAsyncState(async () => {
      if (shouldFail) throw new Error("boom");
      return "ok";
    });

    await state.execute();
    expect(state.error.value).toBeInstanceOf(Error);

    shouldFail = false;
    await state.execute();

    expect(state.error.value).toBeNull();
    expect(state.data.value).toBe("ok");
  });

  // Гонка: быстрый ввод в поиске запускает несколько загрузок, и первая может
  // ответить последней. Устаревший результат обязан быть отброшен.
  it("игнорирует результат устаревшего запуска", async () => {
    const delays = [50, 0];
    let call = 0;

    const state = useAsyncState(async () => {
      const index = call++;
      await new Promise((resolve) => setTimeout(resolve, delays[index]));

      return `run-${index}`;
    });

    const slow = state.execute();
    const fast = state.execute();
    await Promise.all([slow, fast]);

    expect(state.data.value).toBe("run-1");
  });
});
