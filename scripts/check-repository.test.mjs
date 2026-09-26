import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkRepository } from "./check-repository.mjs";

test("repository check rejects broken encoding and missing ADR index entries", (t) => {
  const root = mkdtempSync(join(tmpdir(), "repository-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const decisions = join(root, "docs/decisions");
  mkdirSync(decisions, { recursive: true });
  writeFileSync(join(decisions, "0001-example.md"), "# Example");
  const index = join(decisions, "README.md");
  writeFileSync(index, "[0001](0001-example.md)");
  assert.doesNotThrow(() => checkRepository(root));
  writeFileSync(index, "# Empty");
  assert.throws(() => checkRepository(root), /индексе/);
  writeFileSync(index, "[0001](0001-example.md) [0002](0002-missing.md)");
  assert.throws(() => checkRepository(root), /отсутствующий ADR/);
  writeFileSync(index, Buffer.from([0xff]));
  assert.throws(() => checkRepository(root), /encoded data/);
});
