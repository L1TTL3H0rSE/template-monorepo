import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkImportOutput } from "./check-import-output.mjs";
import { assertFresh, libraryPackages } from "./dist-fresh.mjs";

export async function checkExports(directory) {
  const failures = [];
  const manifest = JSON.parse(
    readFileSync(join(directory, "package.json"), "utf8"),
  );
  let runtimeExports = 0;
  async function checkExport(value, condition = "") {
    if (typeof value === "object" && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        await checkExport(child, key);
      }
    } else if (typeof value === "string" && value.includes("*")) {
      // В exports звёздочка допускает вложенные пути, в отличие от glob '*'.
      const matches = globSync(value.replaceAll("*", "**/*"), {
        cwd: directory,
      });
      if (!matches.some((file) => statSync(join(directory, file)).isFile())) {
        failures.push(`Wildcard экспорт не находит файлов: ${value}`);
      }
    } else if (typeof value === "string") {
      const file = join(directory, value);
      if (!existsSync(file)) {
        failures.push(`Отсутствует публичный экспорт: ${file}`);
      } else if (condition !== "types" && /\.[cm]?js$/.test(file)) {
        await import(pathToFileURL(file).href);
        runtimeExports++;
      }
    }
  }
  await checkExport(manifest.exports);
  if (!runtimeExports) {
    failures.push(`${directory}: нет проверенного JS-экспорта.`);
  }
  return failures;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  for (const directory of libraryPackages()) {
    assertFresh(directory);
    const failures = [
      ...checkImportOutput(join(directory, "dist")),
      ...(await checkExports(directory)),
    ];
    if (failures.length) {
      throw new Error(failures.join("\n"));
    }
  }
}
