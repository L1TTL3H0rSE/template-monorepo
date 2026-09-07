// Сквозная проверка только зафиксированного дерева; исходный checkout не меняется.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { Blocked, command, freePort, launch, npmCommand, ready, removeOwned, snapshot, stop } from "./e2e/runtime.mjs";
import { smoke } from "./e2e/browser.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: {
  ref: { type: "string", default: "HEAD" },
  profile: { type: "string", default: "all" },
  "output-dir": { type: "string" },
  "timeout-ms": { type: "string", default: "3600000" },
  help: { type: "boolean" },
} });
if (values.help) {
  console.log("node scripts/verify-template.mjs [--ref COMMIT] [--profile all|mock|live-local|identity] [--output-dir NEW_DIRECTORY] [--timeout-ms 3600000]");
  process.exit(0);
}
assert.ok(["all", "mock", "live-local", "identity"].includes(values.profile), "неизвестный профиль");
const frontendEnabled = ["all", "mock"].includes(values.profile);
const liveEnabled = ["all", "live-local"].includes(values.profile);
const timeoutMs = Number(values["timeout-ms"]);
assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2_147_483_647, "timeout-ms должен быть положительным целым <= 2147483647");
// mkdir без recursive запрещает перезапись чужого отчёта, в том числе параллельно.
const output = values["output-dir"] ? resolve(values["output-dir"]) : join(tmpdir(), `template-report-${randomUUID()}`);
const outputRelative = relative(root, output);
assert.ok(isAbsolute(outputRelative) || outputRelative === ".." || outputRelative.startsWith(`..${sep}`), "отчёт должен быть вне исходного checkout");
mkdirSync(output);
const workspace = mkdtempSync(join(tmpdir(), "template-e2e-"));
const report = { schemaVersion: 1, ref: values.ref, profile: values.profile, output, workspace, startedAt: new Date().toISOString(), stages: [] };
const aborter = new AbortController();
const interrupt = reason => { report.interrupted = reason; aborter.abort(); };
const onInt = () => interrupt("SIGINT");
const onTerm = () => interrupt("SIGTERM");
process.on("SIGINT", onInt);
process.on("SIGTERM", onTerm);
const deadline = setTimeout(() => interrupt("timeout"), timeoutMs);
const signal = aborter.signal;
const run = (cmd, args, options = {}) => command(cmd, args, { cwd: workspace, signal, ...options });
const save = () => {
  const file = join(output, "report.json");
  writeFileSync(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n");
  renameSync(`${file}.tmp`, file);
};
function register(id) {
  const record = { id, status: "not-run" };
  report.stages.push(record);
  return record;
}
async function stage(record, action, enabled = true) {
  if (!enabled || signal.aborted) { save(); return false; }
  record.startedAt = new Date().toISOString();
  console.log(`[${record.id}] start`);
  save();
  try { record.details = await action(); record.status = "passed"; }
  catch (error) { record.status = error instanceof Blocked ? "blocked" : "failed"; record.error = error.stack; }
  record.finishedAt = new Date().toISOString();
  save();
  console.log(`[${record.id}] ${record.status}${record.error ? `: ${record.error.split("\n")[0]}` : ""}`);
  return record.status === "passed";
}
const source = register("source");
const tests = register("template-tests");
const tools = register("tools-install");
const browser = register("browser-install");
const docker = register("docker");
const toolchain = register("go-toolchain");
const names = ["acme", "overlap"];
const projects = names.map(name => ({ name, steps: Object.fromEntries([
  "copy", "initialize", "consistency", "project-tests", "install", "build:local", "lint", "typecheck", "test", "web-build", "storybook", "documented-dev",
  "go-kit-build", "go-kit-vet", "go-kit-test", "go-gotemplate-build", "go-gotemplate-vet", "go-gotemplate-test",
  "documentation", "mock-browser", "postgres", "backend-build", "migrations", "api", "cleanup",
].map(step => [step, register(`${name}/${step}`)])) }));
const cleanup = register("cleanup");
let pnpm, chromium, sourceIdentity, sourceMetadata;
let sourceStatus;
try {
  const sourceOK = await stage(source, async () => {
    report.commit = await run("git", ["rev-parse", "--verify", "--end-of-options", `${values.ref}^{commit}`], { cwd: root });
    sourceStatus = await command("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root });
    const canonical = join(workspace, "source");
    await clone(canonical);
    sourceMetadata = JSON.parse(readFileSync(join(canonical, ".template.json")));
    assert.equal(sourceMetadata.initialized, false, "нужен commit чистого шаблона");
    sourceIdentity = sourceMetadata.sourceIdentity;
    report.node = process.version;
    return { commit: report.commit, sourceStatus };
  });
  await stage(tests, () => run(process.execPath, ["--test", "scripts/*.test.mjs", "scripts/e2e/runtime.test.mjs"], {
    cwd: join(workspace, "source"), log: join(output, "template-tests.log"),
  }), sourceOK);
  const toolsOK = await stage(tools, async () => {
    const dir = join(workspace, "tools");
    mkdirSync(dir);
    for (const file of ["package.json", "package-lock.json"]) cpSync(join(workspace, "source/scripts/e2e", file), join(dir, file));
    const [npm, prefix] = npmCommand();
    await run(npm, [...prefix, "ci", "--no-audit", "--no-fund"], { cwd: dir, log: join(output, "tools-install.log") });
    pnpm = join(dir, "node_modules/pnpm/bin/pnpm.cjs");
    const version = await run(process.execPath, [pnpm, "--version"]);
    assert.equal(`pnpm@${version}`, JSON.parse(readFileSync(join(workspace, "source/frontend/package.json"))).packageManager);
    // Playwright читает путь при импорте, а не при launch.
    process.env.PLAYWRIGHT_BROWSERS_PATH = join(workspace, "browsers");
    ({ chromium } = await import(pathToFileURL(join(dir, "node_modules/playwright/index.mjs"))));
    return { pnpm: version };
  }, sourceOK && frontendEnabled);
  const browserOK = await stage(browser, async () => {
    await run(process.execPath, [join(workspace, "tools/node_modules/playwright/cli.js"), "install", "chromium"], {
      env: { PLAYWRIGHT_BROWSERS_PATH: join(workspace, "browsers") }, log: join(output, "browser-install.log"),
    });
    try { const probe = await chromium.launch({ headless: true }); await probe.close(); }
    catch (error) {
      if (/missing dependencies|error while loading shared libraries/i.test(error.message)) throw new Blocked(error.message);
      throw error;
    }
  }, toolsOK);
  const dockerOK = await stage(docker, async () => {
    try { return await run("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 30_000 }); }
    catch (error) { throw new Blocked(`Docker недоступен: ${error.message}`); }
  }, sourceOK && liveEnabled);
  const goOK = await stage(toolchain, async () => {
    report.go = await run("go", ["version"], { env: { GOTOOLCHAIN: "local" } });
    return report.go;
  }, sourceOK && values.profile !== "identity");

  for (const project of projects) {
    const { steps, name } = project;
    const dir = join(workspace, name === "overlap" ? "project with spaces" : "project");
    const target = name === "acme" ? {
      displayName: "Acme Verification", slug: "acme-check", repositoryName: "acme-platform", npmScope: "@acme-check", goModulePrefix: "example.com/acme-platform",
    } : {
      displayName: `${sourceIdentity?.displayName} Next`, slug: `${sourceIdentity?.slug}-next`,
      repositoryName: `${sourceIdentity?.repositoryName}-next`, npmScope: `${sourceIdentity?.npmScope}-next`,
      goModulePrefix: `example.com/${sourceIdentity?.goModulePrefix}-next`,
    };
    project.identity = target;
    const log = step => join(output, `${name}-${step.replaceAll(":", "-")}.log`);
    const node = (args, options = {}) => run(process.execPath, args, { cwd: dir, ...options });
    const front = (args, step) => node([pnpm, ...args], {
      cwd: join(dir, "frontend"), env: { CI: "true", NUXT_PUBLIC_API_PROVIDER: "mock" }, log: log(step),
    });
    const go = (module, args, step) => run("go", args, {
      cwd: join(dir, "backend", module), env: { GOWORK: "off", GOTOOLCHAIN: "local", GOFLAGS: "-mod=readonly" }, log: log(step),
    });
    const copied = await stage(steps.copy, () => clone(dir), sourceOK);
    const initialized = await stage(steps.initialize, async () => {
      const args = ["scripts/init-project.mjs", ...Object.entries(target).flatMap(([key, value]) => ["--" + key.replace(/[A-Z]/g, c => "-" + c.toLowerCase()), value])];
      const initial = snapshot(dir);
      await node([...args, "--dry-run"], { log: log("dry-run") });
      assert.equal(snapshot(dir), initial, "dry-run изменил файлы");
      for (const invalid of [["--npm-scope", "invalid"], ["--go-module-prefix", "has spaces"], ["--unknown"]]) {
        await node([...args, "--force", ...invalid], { expected: 1, log: log("invalid-rejection") });
        assert.equal(snapshot(dir), initial, "невалидные аргументы изменили файлы");
      }
      const marker = join(dir, "unrelated.bin");
      writeFileSync(marker, Buffer.from([0, 127, 255]));
      const dirty = snapshot(dir);
      await node(args, { expected: 1, log: log("dirty-rejection") });
      assert.equal(snapshot(dir), dirty, "отказ на грязном дереве изменил файлы");
      await node([...args, "--force"], { log: log("initialize") });
      assert.deepEqual(readFileSync(marker), Buffer.from([0, 127, 255]));
      const after = snapshot(dir);
      for (const flags of [[], ["--force"], ["--dry-run"], ["--force", "--dry-run"]]) {
        await node([...args, ...flags], { expected: 1, log: log("repeat-rejection") });
        assert.equal(snapshot(dir), after, "повторная инициализация изменила файлы");
      }
      await node(["scripts/check-template-residue.mjs"], { log: log("residue") });
    }, copied);
    const consistent = await stage(steps.consistency, () => consistency(dir, target), initialized);
    await stage(steps["project-tests"], () => node(["--test", "scripts/*.test.mjs"], { log: log("project-tests") }), consistent);
    const installed = await stage(steps.install, () => front(["install", "--frozen-lockfile"], "install"), consistent && toolsOK);
    const built = await stage(steps["build:local"], () => front(["build:local"], "build-local"), installed);
    for (const step of ["lint", "typecheck", "test"]) await stage(steps[step], () => front([step], step), built);
    const web = await stage(steps["web-build"], () => front(["--filter", `${target.npmScope}/web`, "build"], "web-build"), built);
    await stage(steps.storybook, () => front(["build:storybook"], "storybook"), built);
    for (const module of ["kit", "gotemplate"]) {
      for (const step of ["build", "vet", "test"]) await stage(steps[`go-${module}-${step}`], () => go(module, [step, "./..."], `go-${module}-${step}`), consistent && goOK);
    }
    await stage(steps.documentation, async () => {
      const docs = readFileSync(join(dir, "docs/conventions/checks.md"), "utf8");
      for (const cmd of ["pnpm build:local", "pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build:storybook", "go build ./...", "go vet ./...", "go test ./..."]) assert.ok(docs.includes(cmd), `документация потеряла ${cmd}`);
      const readme = readFileSync(join(dir, "README.md"), "utf8");
      assert.ok(readme.includes(`pnpm --filter ${target.npmScope}/web dev`));
      await go("gotemplate", ["run", "github.com/magefile/mage", "-l"], "mage-list");
      await go("gotemplate", ["run", "github.com/magefile/mage", "lint"], "mage-lint");
      return { commands: "Команды проверок выполнены отдельными этапами; Magefile с build tag скомпилирован и lint выполнен." };
    }, consistent && goOK);
    await stage(steps["documented-dev"], async () => {
      const port = await freePort();
      const proc = launch(process.execPath, [pnpm, "--filter", `${target.npmScope}/web`, "dev", "--host", "127.0.0.1", "--port", String(port)], {
        cwd: join(dir, "frontend"), env: { NUXT_PUBLIC_API_PROVIDER: "mock", CI: "true" }, log: log("documented-dev"),
      });
      try {
        await ready(`http://127.0.0.1:${port}`, proc, signal);
        const html = await (await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })).text();
        assert.ok(html.includes(`${target.displayName} — главная`));
        return { command: `pnpm --filter ${target.npmScope}/web dev`, port };
      } finally { await stop(proc); }
    }, built);
    await stage(steps["mock-browser"], async () => {
      const port = await freePort();
      const proc = launch(process.execPath, [".output/server/index.mjs"], {
        cwd: join(dir, "frontend/applications/web"), env: { HOST: "127.0.0.1", PORT: String(port), NUXT_PUBLIC_API_PROVIDER: "mock" }, log: log("mock-server"),
      });
      try {
        await ready(`http://127.0.0.1:${port}`, proc, signal);
        await smoke(chromium, `http://127.0.0.1:${port}`, target.displayName, join(output, `${name}-browser`), signal);
        return { port, viewports: [1365, 390], flow: "главная → список → создание → поиск → удаление → reload" };
      } finally { await stop(proc); }
    }, web && browserOK);
    if (liveEnabled && consistent && dockerOK && goOK) await live(dir, name, steps, go, log);
    else if (liveEnabled && consistent && !dockerOK) {
      steps.postgres.status = "blocked";
      steps.postgres.error = "Профиль требует доступного Docker; общая БД не используется.";
      save();
    }
    await stage(steps.cleanup, () => { removeOwned(workspace, dir); assert.ok(!existsSync(dir)); }, copied && !signal.aborted && steps.cleanup.status !== "failed");
  }
} catch (error) {
  const fatal = register("fatal");
  fatal.status = "failed";
  fatal.error = error.stack;
} finally {
  // Cleanup выполняется и после SIGINT/SIGTERM; прерванные этапы не становятся pass.
  const wasAborted = signal.aborted;
  cleanup.startedAt = new Date().toISOString();
  try {
    removeOwned(tmpdir(), workspace);
    assert.ok(!existsSync(workspace));
    if (sourceStatus !== undefined) assert.equal(await command("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root }), sourceStatus, "исходный checkout изменился во время прогона");
    cleanup.status = "passed";
  } catch (error) { cleanup.status = "failed"; cleanup.error = error.stack; }
  cleanup.finishedAt = new Date().toISOString();
  report.finishedAt = new Date().toISOString();
  report.status = report.stages.some(s => s.status === "failed") || wasAborted ? "failed" : report.stages.some(s => s.status === "blocked") ? "blocked" : "passed";
  save();
  console.log(`Отчёт: ${join(output, "report.json")} (${report.status})`);
  process.exitCode = report.status === "passed" ? 0 : report.status === "blocked" ? 2 : 1;
  clearTimeout(deadline);
  process.removeListener("SIGINT", onInt);
  process.removeListener("SIGTERM", onTerm);
}

async function clone(dir) {
  await run("git", ["clone", "--no-local", "--no-checkout", "--quiet", root, dir]);
  await run("git", ["-c", "core.autocrlf=false", "checkout", "--detach", "--quiet", report.commit], { cwd: dir });
  await run("git", ["config", "core.autocrlf", "false"], { cwd: dir });
  assert.equal(await run("git", ["status", "--porcelain"], { cwd: dir }), "");
  assert.ok(!existsSync(join(dir, ".git/objects/info/alternates")), "clone зависит от исходного object store");
}

function consistency(dir, target) {
  const metadata = JSON.parse(readFileSync(join(dir, ".template.json")));
  assert.equal(metadata.initialized, true);
  assert.deepEqual(metadata.sourceIdentity, sourceIdentity);
  assert.deepEqual(metadata.projectIdentity, target);
  assert.deepEqual(metadata.demo, sourceMetadata.demo);
  const packages = ["frontend", ...["packages", "applications"].flatMap(group => readdirSync(join(dir, "frontend", group)).map(name => `frontend/${group}/${name}`))];
  const manifests = packages.map(path => JSON.parse(readFileSync(join(dir, path, "package.json"))));
  const packageNames = new Set(manifests.map(pkg => pkg.name));
  assert.ok(packageNames.size >= 6);
  for (const pkg of manifests) {
    assert.ok(pkg.name.startsWith(`${target.npmScope}/`), pkg.name);
    for (const [dep, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (version.startsWith("workspace:")) assert.ok(packageNames.has(dep), `${pkg.name}: ${dep}`);
    }
  }
  for (const module of ["kit", "gotemplate"]) {
    assert.ok(readFileSync(join(dir, "backend", module, "go.mod"), "utf8").startsWith(`module ${target.goModulePrefix}/${module}\n`));
  }
  const config = readFileSync(join(dir, "frontend/applications/web/nuxt.config.ts"), "utf8");
  assert.ok(config.includes(`title: "${target.displayName}"`));
  assert.ok(config.includes(`${target.npmScope}/components/styles`));
  const adoption = readFileSync(join(dir, "docs/decisions/ADOPTION.md"), "utf8");
  const rows = adoption.split("\n").filter(line => /^\| \[\d{4}\]/.test(line));
  assert.ok(rows.length > 0, "пустая таблица принятия ADR");
  for (const row of rows) assert.ok(row.includes("pending"), row);
  assert.ok(existsSync(join(dir, "backend/gotemplate/internal/infra/services/example")));
  assert.ok(existsSync(join(dir, "frontend/applications/web/app/contracts/character.ts")));
  return { packages: [...packageNames], modules: ["kit", "gotemplate"], inheritedADR: rows.length };
}

async function live(dir, name, steps, go, log) {
  const container = `template-e2e-${randomUUID()}`;
  const password = randomUUID();
  let proc;
  steps.postgres.resource = { container, label: `template-e2e=${container}` };
  save();
  try {
    const pg = await stage(steps.postgres, async () => {
      // Намеренно без compose up: только свой контейнер, tmpfs и ephemeral port.
      const compose = JSON.parse(await run("docker", ["compose", "-f", join(dir, "docker-compose.yml"), "config", "--format", "json"]));
      const image = compose.services.postgres.image;
      assert.equal(compose.services.gotemplate.environment.DB_NAME, sourceMetadata.demo.backendReferenceService);
      try { await run("docker", ["image", "inspect", image]); }
      catch (error) { if (signal.aborted) throw error; await run("docker", ["pull", image], { log: log("postgres-pull") }); }
      // Создание короткое и не прерывается посередине: после отмены клиентского
      // запроса Docker иначе может создать контейнер уже ПОСЛЕ cleanup.
      await run("docker", ["create", "--pull=never", "--name", container, "--label", `template-e2e=${container}`, "--publish", "127.0.0.1::5432", "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_DB=verification", "-e", "POSTGRES_USER=verification", "-e", `POSTGRES_PASSWORD=${password}`, image], { signal: undefined, timeout: 60_000, log: log("postgres-create") });
      await run("docker", ["start", container]);
      for (let i = 0; i < 60; i++) {
        try { await run("docker", ["exec", container, "pg_isready", "-U", "verification", "-d", "verification"], { timeout: 5000 }); return { container }; }
        catch (error) { if (signal.aborted || i === 59) throw error; await delay(500); }
      }
    });
    const built = await stage(steps["backend-build"], async () => {
      await go("gotemplate", ["build", "-o", "bin/app.exe", "./cmd/app"], "backend-build");
      await go("gotemplate", ["build", "-o", "bin/bootstrap.exe", "./cmd/bootstrap"], "bootstrap-build");
    }, pg);
    let url, env;
    const migrated = await stage(steps.migrations, async () => {
      const info = JSON.parse(await run("docker", ["inspect", container]))[0];
      const port = await freePort();
      env = {
        DB_HOST: "127.0.0.1", DB_PORT: info.NetworkSettings.Ports["5432/tcp"][0].HostPort,
        DB_NAME: "verification", DB_USER: "verification", DB_PASSWORD: password, DB_SSL_MODE: "disable",
        SERVER_HOST: "127.0.0.1", SERVER_PORT: String(port), LOG_FORMAT: "json",
        GOWORK: "off", GOTOOLCHAIN: "local", GOFLAGS: "-mod=readonly",
      };
      url = `http://127.0.0.1:${port}`;
      const cwd = join(dir, "backend/gotemplate");
      const app = join(cwd, "bin/app.exe");
      proc = launch("go", ["run", "./cmd/app"], { cwd, env, log: log("backend") });
      await ready(`${url}/health`, proc, signal);
      const migration = await run("docker", ["exec", container, "psql", "-U", "verification", "-d", "verification", "-Atc", "SELECT version, dirty FROM schema_migrations"]);
      assert.match(migration, /^\d+\|f$/);
      for (let i = 0; i < 2; i++) await run(join(cwd, "bin/bootstrap.exe"), [], { cwd, env, log: log("bootstrap") });
      const seedCount = await run("docker", ["exec", container, "psql", "-U", "verification", "-d", "verification", "-Atc", "SELECT count(*) FROM example WHERE name = 'Root example'"]);
      assert.equal(seedCount, "1", "повторный bootstrap создал дубликаты");
      // Повторный запуск доказывает идемпотентность миграций, а не только health.
      await stop(proc);
      proc = launch(app, [], { cwd, env, log: log("backend") });
      await ready(`${url}/health`, proc, signal);
      return { migration, port };
    }, built);
    await stage(steps.api, () => apiSmoke(url), migrated);
  } finally {
    // Идентификатор известен до старта: даже ошибка start оставляет удаляемый ресурс.
    try { await stop(proc); }
    finally {
      try {
        // create мог завершиться в Docker уже после отмены клиентского процесса.
        const owned = await command("docker", ["ps", "-aq", "--filter", `label=template-e2e=${container}`], { timeout: 30_000 });
        for (const id of owned.split(/\s+/).filter(Boolean)) await command("docker", ["rm", "-f", "-v", id], { timeout: 30_000 });
        assert.equal(await command("docker", ["ps", "-aq", "--filter", `label=template-e2e=${container}`], { timeout: 30_000 }), "");
      } catch (error) { steps.cleanup.status = "failed"; steps.cleanup.error = error.stack; save(); throw error; }
    }
  }
}

async function apiSmoke(url) {
  const headers = { "Content-Type": "application/json", "X-User-ID": randomUUID() };
  const request = async (path, method = "GET", body, status = 200, authenticated = true) => {
    const response = await fetch(`${url}/api/v1/example${path}`, {
      method, headers: authenticated ? headers : {}, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    assert.equal(response.status, status, `${method} ${path}: ${response.status}`);
    if (status === 204) return;
    const payload = await response.json();
    assert.equal(payload.error, status >= 400);
    return payload.data;
  };
  await request("", "GET", undefined, 401, false);
  await request("", "POST", { name: "" }, 400);
  const created = await request("", "POST", { name: "E2E example" }, 201);
  assert.ok(created.id);
  assert.equal((await request(`/${created.id}`)).name, "E2E example");
  assert.equal((await request(`/${created.id}`, "PATCH", { name: "Renamed example" })).name, "Renamed example");
  const found = await request("?q=Renamed&size=20&from=0");
  assert.equal(found.total, 1);
  assert.equal(found.items[0].id, created.id);
  await request(`/${created.id}`, "DELETE", undefined, 204);
  await request(`/${created.id}`, "GET", undefined, 404);
  return { flow: "401 → validation → create → read → patch → search → delete → 404" };
}
