import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { h } from "vue";

import Button from "../src/components/Button.vue";
import Card from "../src/components/Card.vue";

describe("Card", () => {
  it("сохраняет контейнер и отдельное действие в footer", async () => {
    const action = vi.fn();
    const wrapper = mount(Card, {
      props: { title: "Персонаж", variant: "outlined", padding: "compact" },
      slots: {
        default: "Описание",
        footer: () => h(Button, { label: "Открыть", onClick: action }),
      },
    });

    expect(wrapper.element.tagName).toBe("SECTION");
    expect(wrapper.attributes("variant")).toBe("outlined");
    expect(wrapper.attributes("padding")).toBe("compact");
    expect(wrapper.attributes("role")).toBeUndefined();
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    expect(wrapper.get(".card__title").text()).toBe("Персонаж");
    expect(wrapper.get(".card__body").text()).toBe("Описание");
    await wrapper.trigger("click");
    expect(action).not.toHaveBeenCalled();
    await wrapper.get(".card__footer button").trigger("click");
    await flushPromises();
    expect(action).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
