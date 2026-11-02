import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

import { useAsyncState } from "../src/data/useAsyncState";

describe("useAsyncState", () => {
  it.each(["resolve", "reject"] as const)(
    "scope stop запрещает поздний %s и новый запуск",
    async (outcome) => {
      let resolve!: (value: string) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const loader = vi.fn((_signal: AbortSignal) => promise);
      const scope = effectScope();
      const state = scope.run(() => useAsyncState(loader))!;
      const run = state.execute();

      scope.stop();
      expect(loader.mock.calls[0]![0].aborted).toBe(true);
      if (outcome === "resolve") {
        resolve("late");
      } else {
        reject(new Error("late"));
      }
      expect(await run).toBeUndefined();
      expect(state.data.value).toBeUndefined();
      expect(state.error.value).toBeNull();
      expect(state.pending.value).toBe(false);
      expect(await state.execute()).toBeUndefined();
      expect(loader).toHaveBeenCalledTimes(1);
    },
  );

  it("reset и новый execute не принимают ошибку и finally старого запуска", async () => {
    let rejectOld!: (reason: unknown) => void;
    let resolveNew!: (value: string) => void;
    const old = new Promise<string>((_resolve, reject) => {
      rejectOld = reject;
    });
    const fresh = new Promise<string>((resolve) => {
      resolveNew = resolve;
    });
    const loader = vi
      .fn((_signal: AbortSignal) => fresh)
      .mockReturnValueOnce(old);
    const state = useAsyncState(loader);
    const first = state.execute();
    state.reset();
    expect(loader.mock.calls[0]![0].aborted).toBe(true);
    const second = state.execute();
    rejectOld(new Error("old"));
    await first;
    expect(state.pending.value).toBe(true);
    expect(state.error.value).toBeNull();
    resolveNew("new");
    expect(await second).toBe("new");
    expect(state.data.value).toBe("new");
    state.dispose();
    state.dispose();
    expect(await state.execute()).toBeUndefined();
  });

  it("reset без нового запроса запрещает поздний успешный ответ", async () => {
    let resolve!: (value: string) => void;
    const state = useAsyncState(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const run = state.execute();
    state.reset();
    resolve("late");
    await run;
    expect(state.data.value).toBeUndefined();
    expect(state.pending.value).toBe(false);
  });

  it("замещение передаёт новый signal и отменяет прежний", async () => {
    const signals: AbortSignal[] = [];
    const state = useAsyncState(async (signal) => {
      signals.push(signal);
      return signals.length;
    });
    const first = state.execute();
    const second = state.execute();
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
    await Promise.all([first, second]);
    expect(state.data.value).toBe(2);
  });

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
      if (shouldFail) {
        throw new Error("boom");
      }
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
