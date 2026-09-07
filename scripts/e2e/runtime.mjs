import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, lstatSync, openSync, readdirSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export class Blocked extends Error {}

export function snapshot(root) {
  const hash = createHash("sha256");
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git") continue;
      const path = join(dir, name);
      const stat = lstatSync(path);
      hash.update(relative(root, path));
      hash.update(String(stat.mode));
      if (stat.isSymbolicLink()) hash.update(readlinkSync(path));
      else if (stat.isDirectory()) walk(path);
      else hash.update(readFileSync(path));
    }
  }
  walk(root);
  return hash.digest("hex");
}

export function removeOwned(parent, target) {
  const rel = relative(resolve(parent), resolve(target));
  assert.ok(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`), "cleanup вне собственного каталога");
  rmSync(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}

// Все процессы — отдельные группы; завершение pnpm не должно оставлять Nuxt.
export function launch(command, args, { cwd, env = {}, log } = {}) {
  const fd = log ? openSync(log, "a") : undefined;
  const child = spawn(command, args, {
    cwd, env: { ...process.env, ...env }, windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", fd ?? "pipe", fd ?? "pipe"],
  });
  if (fd !== undefined) closeSync(fd);
  let stdout = "", stderr = "";
  child.stdout?.on("data", data => { stdout = (stdout + data).slice(-1024 * 1024); });
  child.stderr?.on("data", data => { stderr = (stderr + data).slice(-1024 * 1024); });
  const done = new Promise(resolve => {
    child.once("error", error => resolve({ code: null, error, stdout, stderr }));
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, done };
}

export async function stop(proc) {
  if (!proc?.child.pid) return;
  const { child } = proc;
  if (process.platform === "win32") {
    if (child.exitCode === null && child.signalCode === null) {
      const killer = launch("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"]);
      await killer.done;
    }
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch (e) { if (e.code !== "ESRCH") throw e; }
    await Promise.race([proc.done, delay(1500)]);
    try { process.kill(-child.pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; }
  }
  await Promise.race([proc.done, delay(5000).then(() => { throw new Error(`процесс ${child.pid} не завершился`); })]);
}

export async function command(command, args, options = {}) {
  if (options.signal?.aborted) throw new Error("проверка прервана");
  const proc = launch(command, args, options);
  let timeout = false;
  const abort = () => { void stop(proc); };
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timeout = true; void stop(proc); }, options.timeout ?? 15 * 60_000);
  try {
    const result = await proc.done;
    if (result.error?.code === "ENOENT") throw new Blocked(`не найден ${command}`);
    if (result.error) throw result.error;
    if (timeout) throw new Error(`таймаут: ${command} ${args.join(" ")}`);
    if (options.signal?.aborted) throw new Error("проверка прервана");
    if (options.expected !== undefined) assert.equal(result.code, options.expected, result.stderr);
    else if (result.code !== 0) throw new Error(`${command} завершился с ${result.code}: ${result.stderr || options.log || result.stdout}`);
    return result.stdout.trim();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function ready(url, proc, signal) {
  for (let i = 0; i < 120; i++) {
    if (signal?.aborted) throw new Error("проверка прервана");
    if (proc.child.exitCode !== null || proc.child.signalCode !== null) throw new Error(`сервер завершился до готовности: ${url}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await delay(500);
  }
  throw new Error(`сервер не готов: ${url}`);
}

export function npmCommand() {
  if (process.platform !== "win32") return ["npm", []];
  // .cmd нельзя запускать через execFile; npm поставляется рядом с node.exe.
  const cli = join(process.execPath, "..", "node_modules", "npm", "bin", "npm-cli.js");
  if (!existsSync(cli)) throw new Blocked(`не найден npm CLI: ${cli}`);
  return [process.execPath, [cli]];
}
