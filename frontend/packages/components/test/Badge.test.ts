import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mount } from "@vue/test-utils";
import { compile, compileString } from "sass-embedded";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { BadgeTone } from "../src/components/Badge.vue";
import Badge from "../src/components/Badge.vue";

const tones: BadgeTone[] = [
  "neutral",
  "primary",
  "success",
  "warning",
  "error",
  "info",
];

function luminance(color: string) {
  expect(color).toMatch(/^#[\da-f]{6}$/i);
  return [0.2126, 0.7152, 0.0722].reduce((total, weight, index) => {
    const channel =
      Number.parseInt(color.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    const linear =
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return total + linear * weight;
  }, 0);
}

describe("Badge", () => {
  const styles = document.createElement("style");

  beforeAll(() => {
    const scss = resolve(import.meta.dirname, "../src/assets/scss");
    const source = readFileSync(
      resolve(import.meta.dirname, "../src/components/Badge.vue"),
      "utf8",
    );
    const body = /<style lang="scss">([\s\S]*?)<\/style>/.exec(source)?.[1];
    expect(body).toBeDefined();
    styles.textContent =
      compile(resolve(scss, "global.scss")).css +
      compileString(`@use "api" as *; ${body}`, { loadPaths: [scss] }).css;
    document.head.append(styles);
  });

  afterAll(() => styles.remove());

  it.each(tones)(
    "сохраняет контраст 4.5:1 для %s с заливкой и subtle",
    (tone) => {
      for (const subtle of [false, true]) {
        const wrapper = mount(Badge, {
          props: { label: tone, tone, subtle },
          attachTo: document.body,
        });
        try {
          const style = getComputedStyle(wrapper.element);
          const foreground = luminance(style.color);
          const background = luminance(style.backgroundColor);
          const ratio =
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05);
          expect(ratio, `${tone}, subtle=${subtle}`).toBeGreaterThanOrEqual(
            4.5,
          );
        } finally {
          wrapper.unmount();
        }
      }
    },
  );
});
