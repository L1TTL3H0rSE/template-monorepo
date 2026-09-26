import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("..", import.meta.url));

export function libraryPackages(root = workspace) {
  const packages = readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, "packages", entry.name))
    .filter((directory) => {
      const manifest = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      );
      return manifest.exports && existsSync(join(directory, "src"));
    });
  if (!packages.length) {
    throw new Error("Не найдены библиотеки workspace для проверки dist.");
  }
  return packages;
}

export function fingerprint(directory) {
  const files = [];
  function walk(root) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const file = join(root, entry.name);
      if (entry.isDirectory()) {
        walk(file);
      } else if (!/\.(?:test|stories)\.[^.]+$/.test(entry.name)) {
        files.push(file);
      }
    }
  }
  walk(join(directory, "src"));
  if (existsSync(join(directory, "scripts"))) {
    walk(join(directory, "scripts"));
  }
  for (const file of readdirSync(directory)) {
    if (
      /^(?:package\.json|tsconfig.*\.json|vite\.config\.[cm]?[jt]s)$/.test(file)
    ) {
      files.push(join(directory, file));
    }
  }
  for (const file of [
    "tsconfig.base.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/dist-fresh.mjs",
    "scripts/check-import-output.mjs",
  ]) {
    files.push(resolve(directory, "../..", file));
  }
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(directory, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function assertFresh(directory) {
  const stamp = join(directory, "dist/.build-hash");
  if (
    !existsSync(stamp) ||
    readFileSync(stamp, "utf8").trim() !== fingerprint(directory)
  ) {
    throw new Error(
      `${directory}: dist отсутствует или устарел; выполните pnpm build:local.`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] === "write") {
    writeFileSync(
      join(process.cwd(), "dist/.build-hash"),
      fingerprint(process.cwd()) + "\n",
    );
  } else if (process.argv[2] === "check") {
    for (const directory of libraryPackages()) {
      assertFresh(directory);
    }
  } else {
    throw new Error("Ожидается действие write или check.");
  }
}
