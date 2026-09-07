import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { command, removeOwned } from "./runtime.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("два одновременных прогона из commit изолированы и удаляют свои копии", async () => {
  const dir = mkdtempSync(join(tmpdir(), "verification-parallel-"));
  try {
    const runs = await Promise.all(["first", "second"].map(async name => {
      const output = join(dir, name);
      await command(process.execPath, [join(ROOT, "scripts/verify-template.mjs"), "--profile", "identity", "--output-dir", output], { timeout: 120_000 });
      return JSON.parse(readFileSync(join(output, "report.json")));
    }));
    assert.notEqual(runs[0].workspace, runs[1].workspace);
    for (const run of runs) {
      assert.equal(run.status, "passed");
      assert.ok(!existsSync(run.workspace));
      assert.equal(run.stages.find(s => s.id === "overlap/initialize").status, "passed");
      assert.equal(run.stages.find(s => s.id === "acme/install").status, "not-run");
    }
    await assert.rejects(command(process.execPath, [join(ROOT, "scripts/verify-template.mjs"), "--output-dir", join(dir, "first")]));
  } finally { removeOwned(tmpdir(), dir); }
});

test("сломанное workspace-ребро даёт failed и всё равно удаляет копии", async () => {
  const dir = mkdtempSync(join(tmpdir(), "verification-red-"));
  try {
    const source = join(dir, "source");
    await command("git", ["clone", "--no-local", "--quiet", ROOT, source]);
    const file = join(source, "frontend/applications/web/package.json");
    const pkg = JSON.parse(readFileSync(file));
    pkg.dependencies["@unrelated/missing"] = "workspace:*";
    writeFileSync(file, JSON.stringify(pkg, null, 2));
    await command("git", ["add", "frontend/applications/web/package.json"], { cwd: source });
    await command("git", ["-c", "user.name=Verification", "-c", "user.email=verification@example.invalid", "commit", "-qm", "test: broken workspace edge"], { cwd: source });
    const output = join(dir, "report");
    await command(process.execPath, [join(source, "scripts/verify-template.mjs"), "--profile", "identity", "--output-dir", output], { expected: 1, timeout: 120_000 });
    const result = JSON.parse(readFileSync(join(output, "report.json")));
    assert.equal(result.status, "failed");
    assert.equal(result.stages.find(s => s.id === "acme/consistency").status, "failed");
    assert.equal(result.stages.find(s => s.id === "cleanup").status, "passed");
    assert.ok(!existsSync(result.workspace));
  } finally { removeOwned(tmpdir(), dir); }
});

test("общий timeout оставляет отчёт failed, not-run и завершённый cleanup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "verification-timeout-"));
  try {
    const output = join(dir, "report");
    await command(process.execPath, [join(ROOT, "scripts/verify-template.mjs"), "--profile", "identity", "--timeout-ms", "100", "--output-dir", output], { expected: 1 });
    const result = JSON.parse(readFileSync(join(output, "report.json")));
    assert.equal(result.status, "failed");
    assert.equal(result.interrupted, "timeout");
    assert.ok(result.stages.some(s => s.status === "not-run"));
    assert.equal(result.stages.find(s => s.id === "cleanup").status, "passed");
    assert.ok(!existsSync(result.workspace));
  } finally { removeOwned(tmpdir(), dir); }
});

test("отчёт внутри исходного дерева отвергается до записи", async () => {
  const output = join(ROOT, "forbidden-verification-output");
  await command(process.execPath, [join(ROOT, "scripts/verify-template.mjs"), "--output-dir", output], { expected: 1 });
  assert.ok(!existsSync(output));
});

test("недоступный Docker даёт blocked даже при exit 0 у docker info", async () => {
  const dir = mkdtempSync(join(tmpdir(), "verification-docker-"));
  try {
    const output = join(dir, "report");
    await command(process.execPath, [join(ROOT, "scripts/verify-template.mjs"), "--profile", "live-local", "--output-dir", output], {
      expected: 2, timeout: 180_000,
      env: { DOCKER_HOST: "tcp://127.0.0.1:1", DOCKER_CONTEXT: "", DOCKER_TLS_VERIFY: "", DOCKER_CERT_PATH: "" },
    });
    const result = JSON.parse(readFileSync(join(output, "report.json")));
    assert.equal(result.status, "blocked");
    assert.equal(result.stages.find(s => s.id === "docker").status, "blocked");
    for (const name of ["acme", "overlap"]) {
      assert.equal(result.stages.find(s => s.id === `${name}/postgres`).status, "blocked");
      assert.equal(result.stages.find(s => s.id === `${name}/api`).status, "not-run");
    }
    assert.equal(result.stages.find(s => s.id === "cleanup").status, "passed");
    assert.ok(!existsSync(result.workspace));
  } finally { removeOwned(tmpdir(), dir); }
});

