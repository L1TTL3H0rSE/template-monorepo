import { describe, expect, it } from "vitest";
import { useFormState } from "../src/forms/useFormState";

describe("useFormState", () => {
  it("отслеживает изменения относительно исходных значений", () => {
    const form = useFormState({ name: "Эйра" });

    expect(form.isDirty.value).toBe(false);

    form.values.name = "Каспиан";

    expect(form.isDirty.value).toBe(true);
  });

  // Двойной клик по «Сохранить» не должен создавать две сущности.
  it("не запускает повторную отправку во время первой", async () => {
    const form = useFormState({ name: "Эйра" });
    let calls = 0;

    const handler = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
    };

    const first = form.submit(handler);
    const second = await form.submit(handler);
    await first;

    expect(calls).toBe(1);
    expect(second).toBe(false);
  });

  it("очищает ошибки перед новой отправкой", async () => {
    const form = useFormState({ name: "" });
    form.setErrors({ name: "Обязательное поле" });

    await form.submit(async () => {});

    expect(form.errors.name).toBeUndefined();
  });

  it("после успешной отправки форма перестаёт быть dirty", async () => {
    const form = useFormState({ name: "Эйра" });
    form.values.name = "Каспиан";

    await form.submit(async () => {});

    expect(form.isDirty.value).toBe(false);
  });

  it("reset возвращает исходные значения", () => {
    const form = useFormState({ name: "Эйра" });
    form.values.name = "Каспиан";

    form.reset();

    expect(form.values.name).toBe("Эйра");
    expect(form.isDirty.value).toBe(false);
  });
});
