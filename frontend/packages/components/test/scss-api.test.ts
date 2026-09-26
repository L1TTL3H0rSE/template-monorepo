import { resolve } from "node:path";

import { compile, compileString } from "sass-embedded";
import { describe, expect, it } from "vitest";

const scss = resolve(import.meta.dirname, "../src/assets/scss");

describe("SCSS API", () => {
  it("не создаёт CSS при импорте без использования", () => {
    expect(compile(resolve(scss, "api.scss")).css).toBe("");
  });

  it("сохраняет миксины и переменные без глобальных правил", () => {
    const { css } = compileString(
      `@use "api" as *;
       .sample {
         @include typography(h-st-2);
         @include focus-ring;
         border-radius: $radius-small;
       }`,
      { loadPaths: [scss] },
    );

    expect(css).toContain("font-size: 0.75rem");
    expect(css).toContain(
      "outline: 2px solid var(--primary-focus-visible-color)",
    );
    expect(css).toContain("border-radius:");
    expect(css).not.toContain(":root");
  });
});
