import { describe, expect, it } from "vitest";
import { MockCharacterAdapter } from "~/adapters/mock/character-adapter";

/**
 * Тест на ПОРТ, а не на реализацию.
 *
 * Он проверяет поведение, которое обязаны давать обе реализации CharacterApi.
 * Ровно поэтому его имеет смысл прогонять и против HTTP-адаптера, когда
 * появится тестовый стенд: расхождение адаптеров — самая дорогая ошибка этой
 * схемы, потому что она проявляется только в проде.
 */
describe("CharacterApi (mock)", () => {
  it("возвращает страницу и общее количество", async () => {
    const api = new MockCharacterAdapter();

    const page = await api.search({ limit: 2, offset: 0 });

    expect(page.items).toHaveLength(2);
    // total — общее число подходящих записей, а не длина страницы.
    expect(page.total).toBe(3);
  });

  it("фильтрует без учёта регистра", async () => {
    const api = new MockCharacterAdapter();

    const page = await api.search({ query: "каспиан", limit: 10, offset: 0 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.name).toContain("Каспиан");
  });

  it("созданный персонаж получает статус draft", async () => {
    const api = new MockCharacterAdapter();

    const created = await api.create({ name: "Новый" });

    expect(created.status).toBe("draft");
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it("удаление уменьшает выдачу", async () => {
    const api = new MockCharacterAdapter();
    const before = await api.search({ limit: 10, offset: 0 });

    await api.remove(before.items[0]!.id);
    const after = await api.search({ limit: 10, offset: 0 });

    expect(after.total).toBe(before.total - 1);
  });
});
