import type {
  Character,
  CharacterApi,
  CharacterDraft,
  CharacterPage,
  CharacterSearch,
  RequestContext,
} from "~/contracts/character";

/**
 * Фикстурная реализация того же порта.
 *
 * Зачем она есть в шаблоне: фронтенд должен разрабатываться и проверяться без
 * поднятого бэкенда, но НЕ ценой второго кода в компонентах. Оба адаптера
 * реализуют один интерфейс, поэтому подмена не видна выше слоя `api`.
 *
 * Задержка имитируется намеренно: без неё состояния загрузки и скелетоны
 * никогда не видны разработчику и ломаются незаметно.
 */
const SEED: Character[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Эйра Полуночная",
    status: "published",
    createdAt: new Date("2026-03-02T10:00:00Z"),
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Каспиан Верт",
    status: "draft",
    createdAt: new Date("2026-04-17T08:30:00Z"),
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Морвен из Пепельной Гряды",
    status: "archived",
    createdAt: new Date("2026-01-09T19:45:00Z"),
  },
];

const LATENCY_MS = 250;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

/**
 * Задержка, которую можно отменить.
 *
 * Без этого mock-провайдер прятал бы гонки, существующие с реальным HTTP:
 * фикстура всегда доводила бы устаревший запрос до конца, и latest-request-wins
 * выглядел бы работающим ровно до переключения на настоящий бэкенд.
 */
function abortableDelay<T>(value: T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(new MockAbortError());

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), LATENCY_MS);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new MockAbortError());
      },
      { once: true },
    );
  });
}

/**
 * Имя `AbortError` выбрано не случайно: ровно его отдаёт fetch, и его же
 * распознаёт `isCancelled` из `@starter/api/core`. Так вызывающий обрабатывает
 * отмену одинаково для обоих провайдеров.
 */
class MockAbortError extends Error {
  constructor() {
    super("Запрос отменён");
    this.name = "AbortError";
  }
}

export class MockCharacterAdapter implements CharacterApi {
  private readonly items = [...SEED];

  async search(
    params: CharacterSearch,
    context?: RequestContext,
  ): Promise<CharacterPage> {
    const query = params.query?.trim().toLowerCase();
    const filtered = query
      ? this.items.filter((item) => item.name.toLowerCase().includes(query))
      : this.items;

    // Срез делается здесь, потому что это фикстура. В HTTP-адаптере пагинация
    // остаётся на сервере — см. docs/frontend/api-and-adapters.md.
    return abortableDelay(
      {
        items: filtered.slice(params.offset, params.offset + params.limit),
        total: filtered.length,
      },
      context?.signal,
    );
  }

  async getById(id: string): Promise<Character> {
    const found = this.items.find((item) => item.id === id);
    if (!found) throw new Error(`Персонаж ${id} не найден`);

    return delay(found);
  }

  async create(draft: CharacterDraft): Promise<Character> {
    const created: Character = {
      id: crypto.randomUUID(),
      name: draft.name,
      status: "draft",
      createdAt: new Date(),
    };
    this.items.unshift(created);

    return delay(created);
  }

  async rename(id: string, name: string): Promise<Character> {
    const found = await this.getById(id);
    found.name = name;

    return delay(found);
  }

  async remove(id: string): Promise<void> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index >= 0) this.items.splice(index, 1);

    await delay(undefined);
  }
}
