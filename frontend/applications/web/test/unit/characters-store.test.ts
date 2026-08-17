import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Character,
  CharacterApi,
  CharacterPage,
  CharacterSearch,
  RequestContext,
} from "~/contracts/character";

/**
 * Тесты семантики интерактивного чтения.
 *
 * Проверяется наблюдаемое поведение — какие параметры доходят до API, какое
 * состояние в итоге видит пользователь, — а не внутреннее устройство стора.
 * Счётчик поколений и `AbortController` могут быть заменены другой реализацией;
 * гарантии остаются.
 */

type SearchCall = {
  params: CharacterSearch;
  signal?: AbortSignal;
  resolve: (page: CharacterPage) => void;
  reject: (reason: unknown) => void;
  promise: Promise<CharacterPage>;
};

/**
 * Управляемая реализация порта: тест сам решает, какой запрос завершится
 * первым. Без этого гонку «медленный первый, быстрый второй» не воспроизвести
 * детерминированно.
 *
 * `honorAbort` управляет тем, реагирует ли транспорт на сигнал.
 *
 * Это не косметика: при `honorAbort: true` отменённый промис уже завершён
 * отказом, и последующий `resolve` физически ничего не делает — такой тест
 * доказывает работу отмены, но НЕ счётчика поколений. Чтобы проверить второй
 * рубеж, нужен транспорт, который сигнал игнорирует.
 */
class ControlledCharacterApi implements CharacterApi {
  readonly calls: SearchCall[] = [];
  honorAbort = true;

  search(
    params: CharacterSearch,
    context?: RequestContext,
  ): Promise<CharacterPage> {
    let resolve!: (page: CharacterPage) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<CharacterPage>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const call: SearchCall = {
      params,
      signal: context?.signal,
      resolve,
      reject,
      promise,
    };
    this.calls.push(call);

    if (this.honorAbort) {
      context?.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    }

    return promise;
  }

  getById(): Promise<Character> {
    throw new Error("не используется в этих тестах");
  }
  create(): Promise<Character> {
    throw new Error("не используется в этих тестах");
  }
  rename(): Promise<Character> {
    throw new Error("не используется в этих тестах");
  }
  remove(): Promise<void> {
    throw new Error("не используется в этих тестах");
  }
}

function page(names: string[], total = names.length): CharacterPage {
  return {
    items: names.map((name, index) => ({
      id: `id-${name}-${index}`,
      name,
      status: "published" as const,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })),
    total,
  };
}

const api = new ControlledCharacterApi();

// Стор получает API через useApi(); подменяем именно этот модуль, а не
// транспорт: тест обязан ходить через порт, как и продакшен-код.
vi.mock("~/api/api", () => ({ useApi: () => ({ characters: api }) }));

const { useCharactersStore } = await import("~/stores/characters");

beforeEach(() => {
  setActivePinia(createPinia());
  api.calls.length = 0;
  api.honorAbort = true;
});

describe("useCharactersStore: интерактивное чтение", () => {
  /**
   * Проверка ВТОРОГО рубежа — счётчика поколений (MEM-022).
   *
   * Транспорт намеренно игнорирует сигнал, поэтому отменённый запрос всё равно
   * доходит до конца и пытается записать состояние. Именно так ведёт себя
   * реализация, не поддерживающая отмену, — и именно этот случай `abort()`
   * закрыть не может: он не отменяет уже разрешившийся промис.
   *
   * Без счётчика поколений в сторе этот тест падает.
   */
  it("устаревший ответ не перезаписывает состояние даже без отмены", async () => {
    api.honorAbort = false;
    const store = useCharactersStore();

    const first = store.load();
    const second = store.load();

    // Второй отвечает первым — типичная гонка при быстром вводе.
    api.calls[1]!.resolve(page(["новый"]));
    await second;

    // Первый доходит позже, полностью успешно, и обязан быть проигнорирован.
    api.calls[0]!.resolve(page(["устаревший"]));
    await first;

    expect(store.items.map((item) => item.name)).toEqual(["новый"]);
    expect(store.pending).toBe(false);
  });

  it("устаревшая ошибка не затирает состояние актуального чтения", async () => {
    api.honorAbort = false;
    const store = useCharactersStore();

    const first = store.load();
    const second = store.load();

    api.calls[1]!.resolve(page(["новый"]));
    await second;

    api.calls[0]!.reject(new Error("устаревший сбой"));
    await first;

    expect(store.error).toBeNull();
    expect(store.items.map((item) => item.name)).toEqual(["новый"]);
  });

  it("устаревший ответ не проходит, когда транспорт отмену поддерживает", async () => {
    const store = useCharactersStore();

    const first = store.load();
    const second = store.load();

    api.calls[1]!.resolve(page(["новый"]));
    await second;

    // Отменённый промис уже отвергнут — resolve ничего не делает. Это
    // проверка ПЕРВОГО рубежа, отмены.
    api.calls[0]!.resolve(page(["устаревший"]));
    await first.catch(() => undefined);

    expect(store.items.map((item) => item.name)).toEqual(["новый"]);
  });

  it("предыдущее чтение отменяется при старте следующего", async () => {
    const store = useCharactersStore();

    const first = store.load();
    expect(api.calls[0]!.signal?.aborted).toBe(false);

    const second = store.load();

    expect(api.calls[0]!.signal?.aborted).toBe(true);
    expect(api.calls[1]!.signal?.aborted).toBe(false);

    api.calls[1]!.resolve(page(["ок"]));
    await second;
    await first.catch(() => undefined);
  });

  it("отмена не показывается пользователю как ошибка", async () => {
    const store = useCharactersStore();

    const first = store.load();
    const second = store.load();

    api.calls[1]!.resolve(page(["ок"]));
    await second;
    await first.catch(() => undefined);

    expect(store.error).toBeNull();
  });

  it("настоящая сетевая ошибка по-прежнему доходит до пользователя", async () => {
    const store = useCharactersStore();

    const loading = store.load();
    api.calls[0]!.reject(new Error("Сервис недоступен"));
    await loading;

    expect(store.error).toBe("Сервис недоступен");
    expect(store.items).toEqual([]);
    expect(store.pending).toBe(false);
  });

  it("устаревшее чтение не снимает индикатор загрузки", async () => {
    const store = useCharactersStore();

    const first = store.load();
    const second = store.load();

    api.calls[0]!.reject(new Error("устаревшая ошибка"));
    await first.catch(() => undefined);

    // Актуальное чтение ещё идёт — индикатор обязан остаться.
    expect(store.pending).toBe(true);
    expect(store.error).toBeNull();

    api.calls[1]!.resolve(page(["ок"]));
    await second;

    expect(store.pending).toBe(false);
  });
});

describe("useCharactersStore: поиск и пагинация", () => {
  it("новый поиск со страницы > 1 выполняет ровно одно чтение", async () => {
    const store = useCharactersStore();

    // Ставим пользователя на третью страницу.
    store.pagination.setTotal(100);
    store.pagination.page = 3;
    await nextTick();
    api.calls.at(-1)?.resolve(page(["страница 3"], 100));
    await flush();

    const before = api.calls.length;

    store.search.raw = "эйра";
    // Debounce поиска: applied меняется по таймеру.
    await vi.waitFor(() => expect(store.search.applied).toBe("эйра"));
    await flush();

    // Ровно одно чтение: сброс страницы и новый поисковый запрос не должны
    // порождать два обращения к API.
    expect(api.calls.length - before).toBe(1);
    expect(api.calls.at(-1)!.params.query).toBe("эйра");
    expect(api.calls.at(-1)!.params.offset).toBe(0);
    expect(store.pagination.page).toBe(1);
  });

  it("поиск с первой страницы тоже выполняет одно чтение", async () => {
    const store = useCharactersStore();
    const before = api.calls.length;

    store.search.raw = "каспиан";
    await vi.waitFor(() => expect(store.search.applied).toBe("каспиан"));
    await flush();

    expect(api.calls.length - before).toBe(1);
    expect(api.calls.at(-1)!.params.query).toBe("каспиан");
  });
});

/** Даёт отработать наблюдателям Vue и микрозадачам. */
async function flush(): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
