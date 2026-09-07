import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Blocked, command, launch, removeOwned, snapshot, stop } from "./runtime.mjs";

test("snapshot замечает изменение и удаление; cleanup отказывает вне владения", () => {
  const root = mkdtempSync(join(tmpdir(), "verification-unit-"));
  try {
    writeFileSync(join(root, "file"), "before");
    const before = snapshot(root);
    writeFileSync(join(root, "file"), "after");
    assert.notEqual(snapshot(root), before);
    for (const target of [root, tmpdir(), `${root}-neighbor`]) assert.throws(() => removeOwned(root, target));
    removeOwned(root, join(root, "file"));
    assert.ok(!existsSync(join(root, "file")));
  } finally { removeOwned(tmpdir(), root); }
});

test("ненулевой exit, missing tool и timeout никогда не дают pass", async () => {
  await assert.rejects(command(process.execPath, ["-e", "process.exit(7)"]), /7/);
  await assert.rejects(command("missing-verification-tool-xyz", []), Blocked);
  await assert.rejects(command(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 100 }), /таймаут/);
});

test("отмена останавливает дерево процессов, чужой процесс продолжает работать", async () => {
  const root = mkdtempSync(join(tmpdir(), "verification-process-"));
  const marker = join(root, "child.pid");
  const unrelated = launch(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  const controller = new AbortController();
  const pending = command(process.execPath, ["-e", `
    const {spawn} = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore', windowsHide: true});
    require('node:fs').writeFileSync(process.argv[1], String(child.pid));
    setInterval(() => {}, 1000);
  `, marker], { signal: controller.signal });
  const rejected = assert.rejects(pending, /прервана/);
  try {
    for (let i = 0; i < 100 && !existsSync(marker); i++) await delay(50);
    assert.ok(existsSync(marker));
    const pid = Number(readFileSync(marker, "utf8"));
    controller.abort();
    await rejected;
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    assert.doesNotThrow(() => process.kill(unrelated.child.pid, 0));
  } finally {
    controller.abort();
    await stop(unrelated);
    removeOwned(tmpdir(), root);
  }
});

