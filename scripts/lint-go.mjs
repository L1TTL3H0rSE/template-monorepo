import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const analyzer = "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2";

const module = resolve(process.argv[2] ?? ".");
if (!existsSync(resolve(module, "go.mod"))) {
  throw new Error(`Go-модуль не найден: ${module}`);
}
const result = spawnSync("go", ["run", analyzer, "run", "./..."], {
  cwd: module,
  stdio: "inherit",
  env: {
    ...process.env,
    GOTOOLCHAIN: "local",
    // Анализатор кеширует абсолютные пути диагностик: кеш не делим между checkout.
    GOLANGCI_LINT_CACHE: process.env.GOLANGCI_LINT_CACHE || resolve(module, ".cache/golangci-lint"),
  },
});
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
