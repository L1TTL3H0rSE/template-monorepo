// Инвентарь клиентских ассетов production-сборки.
//
//   node scripts/report-client-assets.mjs applications/web/.output/public/_nuxt
//   node scripts/report-client-assets.mjs <dir> --json
//
// Что это ЕСТЬ: детерминированный список эмитированных файлов с размерами
// raw / gzip / brotli, сгруппированный по типу. Полезен для сравнения «до и
// после» на performance-sensitive изменении.
//
// Что это НЕ: это не измерение Web Vitals и не оценка критического пути. Без
// графа чанков и запуска в браузере скрипт не знает, что именно грузится на
// первом маршруте. Полный размер бандла и стоимость для пользователя — разные
// величины, и подменять одно другим нельзя.
//
// Порогов здесь намеренно нет: осмысленный бюджет выводится из критических
// маршрутов, целевых устройств и продуктовых требований, а не из числа в
// шаблоне (см. docs/frontend/performance.md).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

const [directoryArgument, ...flags] = process.argv.slice(2);
const asJson = flags.includes("--json");

if (!directoryArgument) {
  console.error(
    "usage: node scripts/report-client-assets.mjs <dir> [--json]\n" +
      "Каталог обязателен: скрипт не угадывает расположение сборки.",
  );
  process.exit(1);
}

const root = resolve(process.cwd(), directoryArgument);

let stats;
try {
  stats = statSync(root);
} catch {
  console.error(
    `report-client-assets: каталог не найден: ${root}\n` +
      "Соберите приложение production-сборкой перед измерением.",
  );
  process.exit(1);
}
if (!stats.isDirectory()) {
  console.error(`report-client-assets: не каталог: ${root}`);
  process.exit(1);
}

const assets = collect(root).map((file) => {
  const bytes = readFileSync(join(root, file));

  return {
    file,
    group: classify(file),
    raw: bytes.length,
    // Уровни фиксированы: иначе «до» и «после» посчитаны по-разному, и
    // сравнение теряет смысл.
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes).length,
  };
});

if (assets.length === 0) {
  console.error(`report-client-assets: в ${root} нет файлов`);
  process.exit(1);
}

const groups = summarize(assets);
const total = assets.reduce(
  (accumulator, asset) => ({
    raw: accumulator.raw + asset.raw,
    gzip: accumulator.gzip + asset.gzip,
    brotli: accumulator.brotli + asset.brotli,
  }),
  { raw: 0, gzip: 0, brotli: 0 },
);

if (asJson) {
  // Без временных меток: вывод обязан быть одинаковым для одинаковой сборки,
  // иначе его нельзя ни закоммитить, ни сравнить.
  process.stdout.write(
    `${JSON.stringify({ directory: relativeToCwd(root), assets, groups, total }, null, 2)}\n`,
  );
} else {
  printText(relativeToCwd(root), assets, groups, total);
}

// --- реализация ---

/** Рекурсивно собирает файлы в детерминированном порядке. */
function collect(directory, prefix = "") {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );

  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...collect(join(directory, entry.name), relativePath));
      continue;
    }
    files.push(relativePath);
  }

  return files;
}

function classify(file) {
  const extension = extname(file).toLowerCase();

  if ([".js", ".mjs", ".cjs"].includes(extension)) return "js";
  if (extension === ".css") return "css";
  if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(extension)) {
    return "fonts";
  }
  if (
    [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico"].includes(
      extension,
    )
  ) {
    return "images";
  }
  if (extension === ".map") return "sourcemaps";

  return "other";
}

function summarize(assets) {
  const byGroup = new Map();

  for (const asset of assets) {
    const current = byGroup.get(asset.group) ?? {
      group: asset.group,
      count: 0,
      raw: 0,
      gzip: 0,
      brotli: 0,
    };

    current.count += 1;
    current.raw += asset.raw;
    current.gzip += asset.gzip;
    current.brotli += asset.brotli;
    byGroup.set(asset.group, current);
  }

  return [...byGroup.values()].sort((a, b) =>
    a.group.localeCompare(b.group, "en"),
  );
}

function printText(directory, assets, groups, total) {
  console.log(`Клиентские ассеты: ${directory}`);
  console.log(
    "Это инвентарь размеров, а не измерение Web Vitals: критический путь " +
      "первого маршрута отсюда не выводится.\n",
  );

  console.log(pad("Группа", 12) + head());
  console.log("-".repeat(12 + 42));
  for (const group of groups) {
    console.log(
      pad(`${group.group} (${group.count})`, 12) +
        row(group.raw, group.gzip, group.brotli),
    );
  }
  console.log("-".repeat(12 + 42));
  console.log(pad("итого", 12) + row(total.raw, total.gzip, total.brotli));

  // Крупнейшие файлы: именно они окупают внимание при разборе роста.
  const largest = [...assets]
    .filter((asset) => asset.group !== "sourcemaps")
    .sort((a, b) => b.brotli - a.brotli || a.file.localeCompare(b.file, "en"))
    .slice(0, 10);

  console.log("\nКрупнейшие файлы (по brotli):");
  for (const asset of largest) {
    console.log(
      `  ${pad(asset.file, 48)}${row(asset.raw, asset.gzip, asset.brotli)}`,
    );
  }
}

function head() {
  return `${pad("raw", 14)}${pad("gzip", 14)}${pad("brotli", 14)}`;
}

function row(raw, gzip, brotli) {
  return `${pad(kb(raw), 14)}${pad(kb(gzip), 14)}${pad(kb(brotli), 14)}`;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function pad(text, width) {
  return String(text).length >= width
    ? `${String(text).slice(0, width - 1)} `
    : String(text).padEnd(width);
}

function relativeToCwd(target) {
  return relative(process.cwd(), target).split(sep).join("/") || ".";
}
