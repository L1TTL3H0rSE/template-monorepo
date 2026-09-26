import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectTextFiles } from "./template-identity.mjs";

export function checkRepository(root) {
  const files = collectTextFiles(root);
  assert.ok(files.length, "Список проверяемых файлов пуст");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const file of files) {
    const text = decoder.decode(readFileSync(resolve(root, file)));
    assert.ok(!text.includes("\uFFFD"), `Повреждённый UTF-8: ${file}`);
  }
  const directory = resolve(root, "docs/decisions");
  const decisions = readdirSync(directory).filter((file) => /^\d{4}-.+\.md$/.test(file));
  assert.ok(decisions.length, "Каталог ADR пуст");
  const index = readFileSync(resolve(directory, "README.md"), "utf8");
  for (const file of decisions) {
    assert.ok(index.includes(`](${file})`), `ADR отсутствует в индексе: ${file}`);
  }
  for (const link of index.matchAll(/\]\((\d{4}-.+?\.md)\)/g)) {
    assert.ok(decisions.includes(link[1]), `Индекс ссылается на отсутствующий ADR: ${link[1]}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkRepository(resolve(fileURLToPath(new URL("..", import.meta.url))));
}
