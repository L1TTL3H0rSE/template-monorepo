import { describe, expect, it } from "vitest";
import { useOptimisticList } from "../src/data/useOptimisticList";

type Item = { id: string; name: string };

const key = (item: Item) => item.id;

describe("useOptimisticList", () => {
  it("показывает созданную запись до её появления в выдаче", () => {
    const list = useOptimisticList<Item>(key);
    const server: Item[] = [{ id: "1", name: "Эйра" }];

    list.trackAdd({ id: "2", name: "Каспиан" });

    expect(list.merge(server).map(key)).toEqual(["2", "1"]);
  });

  // Главный риск оверлея — дубликат: запись видна и как локальная, и как
  // пришедшая с сервера.
  it("не дублирует запись, когда сервер её догнал", () => {
    const list = useOptimisticList<Item>(key);
    const created: Item = { id: "2", name: "Каспиан" };

    list.trackAdd(created);
    const merged = list.merge([{ id: "1", name: "Эйра" }, created]);

    expect(merged.map(key)).toEqual(["1", "2"]);
  });

  it("скрывает удалённую запись до её исчезновения из выдачи", () => {
    const list = useOptimisticList<Item>(key);
    const server: Item[] = [
      { id: "1", name: "Эйра" },
      { id: "2", name: "Каспиан" },
    ];

    list.trackRemove("1");

    expect(list.merge(server).map(key)).toEqual(["2"]);
  });

  it("settle возвращает список к серверному состоянию", () => {
    const list = useOptimisticList<Item>(key);
    list.trackAdd({ id: "2", name: "Каспиан" });

    list.settle("2");

    expect(list.merge([{ id: "1", name: "Эйра" }]).map(key)).toEqual(["1"]);
    expect(list.hasPending()).toBe(false);
  });

  it("confirm снимает оверлей после подтверждения", async () => {
    const list = useOptimisticList<Item>(key);
    list.trackAdd({ id: "2", name: "Каспиан" });

    const consistent = await list.confirm("2", async () => true, {
      initialDelayMs: 0,
    });

    expect(consistent).toBe(true);
    expect(list.hasPending()).toBe(false);
  });

  // Оверлей, оставленный навсегда, показывает запись, которой на сервере может
  // уже не быть, — и расходится с реальностью тем сильнее, чем дольше открыта
  // вкладка.
  it("confirm снимает оверлей даже при исчерпании бюджета", async () => {
    const list = useOptimisticList<Item>(key);
    list.trackAdd({ id: "2", name: "Каспиан" });

    const consistent = await list.confirm("2", async () => false, {
      initialDelayMs: 0,
      attempts: 2,
    });

    expect(consistent).toBe(false);
    expect(list.hasPending()).toBe(false);
  });

  it("hasPending отражает наличие неподтверждённых правок", () => {
    const list = useOptimisticList<Item>(key);

    expect(list.hasPending()).toBe(false);

    list.trackRemove("1");
    expect(list.hasPending()).toBe(true);

    list.reset();
    expect(list.hasPending()).toBe(false);
  });
});
