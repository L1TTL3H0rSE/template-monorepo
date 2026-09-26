import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkImportOutput } from "./check-import-output.mjs";
import { checkExports } from "./check-packages.mjs";
import { assertFresh, fingerprint } from "./dist-fresh.mjs";

test("public exports reject missing concrete targets and empty SCSS wildcards", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "public-exports-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src/scss"), { recursive: true });
  writeFileSync(join(root, "index.mjs"), "export const value = 1;");
  const api = join(root, "src/scss/api.scss");
  writeFileSync(api, "$space: 1rem;");
  const manifest = {
    type: "module",
    exports: { ".": "./index.mjs", "./scss/*": "./src/scss/*" },
  };
  const writeManifest = () =>
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
  writeManifest();
  assert.deepEqual(await checkExports(root), []);
  manifest.exports["./scss/*"] = "./missing/*";
  writeManifest();
  assert.match((await checkExports(root)).join("\n"), /Wildcard/);
  manifest.exports["./scss/*"] = "./src/scss/*";
  writeManifest();
  rmSync(api);
  assert.match((await checkExports(root)).join("\n"), /Wildcard/);
  manifest.exports["."] = "./missing.mjs";
  writeManifest();
  assert.match(
    (await checkExports(root)).join("\n"),
    /Отсутствует публичный экспорт/,
  );
});

test("output imports reject aliases, absolute paths, missing declarations and escapes", (t) => {
  const root = mkdtempSync(join(tmpdir(), "output-imports-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "value.js"), "export const value = 1;");
  writeFileSync(
    join(root, "value.d.ts"),
    "export declare const value: number;",
  );
  const entry = join(root, "index.d.ts");
  writeFileSync(entry, 'export { value } from "./value.js";');
  assert.deepEqual(checkImportOutput(root), []);
  for (const request of [
    "@/value",
    "~/value",
    "/tmp/value",
    "C:/outside.js",
    "../outside.js",
    "./missing.js",
  ]) {
    writeFileSync(
      entry,
      `export type Value = import(${JSON.stringify(request)}).Value;`,
    );
    assert.ok(checkImportOutput(root).length, request);
  }
});

test("dist freshness includes source, compiler inputs and missing stamps", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dist-fresh-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pkg = join(root, "packages/lib");
  mkdirSync(join(pkg, "src"), { recursive: true });
  mkdirSync(join(pkg, "dist"));
  mkdirSync(join(root, "scripts"));
  for (const file of [
    "tsconfig.base.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/dist-fresh.mjs",
    "scripts/check-import-output.mjs",
  ]) {
    writeFileSync(join(root, file), "original");
  }
  const source = join(pkg, "src/index.ts");
  writeFileSync(source, "export const value = 1;");
  assert.throws(() => assertFresh(pkg), /устарел/);
  writeFileSync(join(pkg, "dist/.build-hash"), fingerprint(pkg));
  assert.doesNotThrow(() => assertFresh(pkg));
  writeFileSync(source, "export const value = 2;");
  assert.throws(() => assertFresh(pkg), /устарел/);
  writeFileSync(join(pkg, "dist/.build-hash"), fingerprint(pkg));
  writeFileSync(join(root, "tsconfig.base.json"), "changed");
  assert.throws(() => assertFresh(pkg), /устарел/);
});
