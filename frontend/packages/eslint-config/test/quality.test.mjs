import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";

import boundaries from "../boundaries.js";

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const manifest = (directory) =>
  JSON.parse(
    readFileSync(resolve(workspace, directory, "package.json"), "utf8"),
  );
const api = manifest("packages/api").name;
const components = manifest("packages/components").name;

test("workspace boundaries reject direct, relative, re-export, dynamic and type escapes", async () => {
  const cwd = resolve(workspace, "packages/shared");
  const lint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
      boundaries(pathToFileURL(resolve(cwd, "eslint.config.mjs")).href),
    ],
  });
  for (const code of [
    `import { x } from "${api}";`,
    `export { x } from "${components}";`,
    'export { x } from "../../components/src/index";',
    `const x = import("${api}/src/private");`,
    `type X = import("${api}").X;`,
    "const x = import(name);",
  ]) {
    const [result] = await lint.lintText(code, {
      filePath: resolve(cwd, "src/violation.ts"),
    });
    assert.ok(
      result.messages.some((item) => item.ruleId === "workspace/boundaries"),
      code,
    );
  }
  const [valid] = await lint.lintText('import { ref } from "vue";', {
    filePath: resolve(cwd, "src/valid.ts"),
  });
  assert.equal(valid.errorCount, 0);
});

test("real consumer configs reject a floating promise in source, tests and Vue", async () => {
  for (const [directory, filenames] of [
    [
      "packages/shared",
      ["src/data/useAsyncState.ts", "test/useAsyncState.test.ts"],
    ],
    [
      "applications/web",
      [
        "app/composables/useCharacterForm.ts",
        "test/unit/characters-store.test.ts",
        "app/app.vue",
        "vitest.config.ts",
      ],
    ],
  ]) {
    const cwd = resolve(workspace, directory);
    const lint = new ESLint({ cwd });
    for (const filename of filenames) {
      const code = filename.endsWith(".vue")
        ? '<script setup lang="ts">Promise.resolve(1);</script>'
        : "Promise.resolve(1);";
      const [bad] = await lint.lintText(code, {
        filePath: resolve(cwd, filename),
      });
      assert.ok(
        bad.messages.some(
          (item) =>
            item.ruleId === "@typescript-eslint/no-floating-promises" &&
            item.severity === 2,
        ),
        `${directory}/${filename}: ${JSON.stringify(bad.messages)}`,
      );
      const [voidResult] = await lint.lintText(
        code.replace("Promise.resolve(1);", "void Promise.resolve(1);"),
        { filePath: resolve(cwd, filename) },
      );
      assert.ok(
        voidResult.messages.some(
          (item) => item.ruleId === "@typescript-eslint/no-floating-promises",
        ),
        `void bypass: ${filename}`,
      );
      const [good] = await lint.lintText(
        code.replace(
          "Promise.resolve(1);",
          "Promise.resolve(1).catch(console.error);",
        ),
        { filePath: resolve(cwd, filename) },
      );
      assert.ok(
        !good.messages.some(
          (item) =>
            item.ruleId === "@typescript-eslint/no-floating-promises" ||
            item.fatal,
        ),
        filename,
      );
    }
  }
});
