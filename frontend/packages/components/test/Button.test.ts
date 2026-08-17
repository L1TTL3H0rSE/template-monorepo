import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Button from "../src/components/Button.vue";

/**
 * Тест на контракт разметки, а не на стили.
 *
 * Проверяется то, на что опирается вся система стилей: модификаторы приходят
 * АТРИБУТАМИ, а булев модификатор при `false` атрибута не создаёт. Если это
 * сломать, селекторы `[variant="..."]` перестанут срабатывать молча — CSS не
 * умеет сообщать, что не нашёл элемент.
 *
 * Этот файл заодно демонстрирует, зачем нужен рендер: без mount компонент
 * попал бы в отчёт покрытия импортом и показал бы ложные 100%
 * (см. vitest.config.ts).
 */
describe("Button", () => {
  it("переносит модификаторы в атрибуты", () => {
    const wrapper = mount(Button, {
      props: {
        label: "Действие",
        variant: "outlined",
        size: "large",
        color: "error",
      },
    });

    expect(wrapper.attributes("variant")).toBe("outlined");
    expect(wrapper.attributes("size")).toBe("large");
    expect(wrapper.attributes("color")).toBe("error");
  });

  // Регрессия: `:is-loading="false"` во Vue отрендерил бы is-loading="false",
  // и селектор [is-loading="true"] не сработал бы, а вот [is-loading] —
  // сработал бы всегда. Отсюда правило `|| undefined`.
  it("не создаёт булев атрибут в выключенном состоянии", () => {
    const wrapper = mount(Button, { props: { label: "Действие" } });

    expect(wrapper.attributes("is-loading")).toBeUndefined();
    expect(wrapper.attributes("aria-busy")).toBeUndefined();
  });

  it("помечает состояние загрузки для вспомогательных технологий", () => {
    const wrapper = mount(Button, {
      props: { label: "Действие", loading: true },
    });

    expect(wrapper.attributes("is-loading")).toBe("true");
    expect(wrapper.attributes("aria-busy")).toBe("true");
    expect(wrapper.find(".button__loader").exists()).toBe(true);
  });

  it("не вызывает обработчик в заблокированном состоянии", async () => {
    let calls = 0;
    const wrapper = mount(Button, {
      props: { label: "Действие", disabled: true, onClick: () => calls++ },
    });

    await wrapper.trigger("click");

    expect(calls).toBe(0);
  });

  // Иконка без подписи обязана нести доступное имя, иначе кнопка для
  // скринридера безымянная.
  it("выводит доступное имя из title для иконочной кнопки", () => {
    const wrapper = mount(Button, {
      props: {
        variant: "icon",
        title: "Закрыть",
        icon: { template: "<svg/>" },
      },
    });

    expect(wrapper.attributes("aria-label")).toBe("Закрыть");
  });

  it("не подменяет явно заданный aria-label", () => {
    const wrapper = mount(Button, {
      props: { label: "Ок", ariaLabel: "Подтвердить удаление" },
    });

    expect(wrapper.attributes("aria-label")).toBe("Подтвердить удаление");
  });
});
