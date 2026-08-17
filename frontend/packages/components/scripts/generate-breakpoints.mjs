// Генерирует SCSS- и TS-представления брейкпоинтов из одного источника —
// src/breakpoints.json.
//
// Зачем генератор: брейкпоинт нужен и в CSS (@media), и в JS (useBreakpoints).
// Две рукописные копии расходятся ровно один раз, после чего компонент
// переключается на мобильную вёрстку на одной ширине, а логика — на другой.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../src/breakpoints.json");
const scssTarget = resolve(here, "../src/assets/scss/_breakpoints.scss");
const tsTarget = resolve(here, "../src/utils/_breakpoints.ts");

const breakpoints = JSON.parse(readFileSync(source, "utf8"));
const banner =
  "/* Файл сгенерирован из src/breakpoints.json. Не редактируйте вручную. */";

// Порядок фиксируется по ВОЗРАСТАНИЮ ширины, а не берётся из порядка ключей
// JSON: перестановка строк в источнике не должна менять сгенерированный файл.
// Имена сравниваются с явной локалью "en" — сортировка по умолчанию зависит от
// локали машины и даёт разный результат на Windows и в Linux-CI.
const ordered = Object.entries(breakpoints).sort(
  ([nameA, valueA], [nameB, valueB]) =>
    valueA - valueB || nameA.localeCompare(nameB, "en"),
);

const scss = [
  "// Файл сгенерирован из src/breakpoints.json. Не редактируйте вручную.",
  "// Источник правды один; правьте JSON и запускайте pnpm generate.",
  "",
  ...ordered.map(([name, value]) => `$breakpoint-${name}: ${value}px;`),
  "",
].join("\n");

const ts = [
  banner,
  "",
  "export const breakpoints = {",
  ...ordered.map(([name, value]) => `  ${name}: ${value},`),
  "} as const;",
  "",
  "export type BreakpointName = keyof typeof breakpoints;",
  "",
].join("\n");

writeFileSync(scssTarget, scss, "utf8");
writeFileSync(tsTarget, ts, "utf8");

console.log(
  `breakpoints: сгенерировано ${Object.keys(breakpoints).length} значений`,
);
