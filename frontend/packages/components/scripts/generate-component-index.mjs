// Генерирует src/components/index.ts — публичный барель компонентов.
//
// Зачем генератор: барель, который ведут вручную, рано или поздно отстаёт от
// каталога, и новый компонент оказывается недоступен потребителю без внятной
// ошибки. Здесь список всегда равен содержимому каталога.
//
// Компоненты, имя которых начинается с "_", считаются внутренними и в барель
// не попадают.
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = resolve(here, "../src/components");
const target = resolve(componentsDir, "index.ts");

const files = readdirSync(componentsDir)
  .filter((name) => name.endsWith(".vue") && !name.startsWith("_"))
  // localeCompare с явной локалью "en", а не голый .sort() и не сравнение по
  // умолчанию: порядок readdir зависит от файловой системы, а сортировка без
  // локали — от локали машины. Разный порядок даёт разный сгенерированный
  // файл на Windows и в Linux-CI, и репозиторий оказывается вечно грязным.
  .sort((a, b) => a.localeCompare(b, "en"));

assertNoCaseCollisions(files);
assertPascalCase(files);

const lines = [
  "/* Файл сгенерирован scripts/generate-component-index.mjs. Не редактируйте вручную. */",
  "",
];

for (const file of files) {
  lines.push(
    `export { default as ${file.replace(/\.vue$/, "")} } from "./${file}";`,
  );
}

lines.push("");

// Типы props объявляются прямо в <script setup> через `export type` и
// реэкспортируются отсюда: потребитель типизирует обёртку, не заглядывая в SFC.
for (const file of files) {
  lines.push(`export type * from "./${file}";`);
}

lines.push("");

writeFileSync(target, lines.join("\n"), "utf8");

console.log(`components: барель обновлён, ${files.length} компонентов`);

/**
 * Два файла, отличающиеся только регистром, — рабочая ситуация в Linux и
 * невозможная в NTFS и APFS. Git видит два пути, файловая система хоста — один,
 * и submodule навсегда остаётся dirty без возможности это исправить локально.
 *
 * Проверка стоит здесь, а не в ревью: заметить `Icons.vue` рядом с `icons.vue`
 * глазами в списке из полусотни файлов не получается.
 */
function assertNoCaseCollisions(names) {
  const seen = new Map();

  for (const name of names) {
    const key = name.toLowerCase();
    const previous = seen.get(key);
    if (previous) {
      throw new Error(
        `Компоненты "${previous}" и "${name}" различаются только регистром. ` +
          `В NTFS и APFS это один файл — репозиторий станет неразрешимо грязным. ` +
          `Переименуйте один из них.`,
      );
    }
    seen.set(key, name);
  }
}

/**
 * Имя компонента обязано быть PascalCase: оно становится идентификатором
 * экспорта, а идентификатор в JS регистрозависим всегда — в отличие от имени
 * файла на Windows.
 */
function assertPascalCase(names) {
  const invalid = names.filter(
    (name) => !/^[A-Z][A-Za-z0-9]*\.vue$/.test(name),
  );

  if (invalid.length > 0) {
    throw new Error(
      `Имена компонентов должны быть PascalCase: ${invalid.join(", ")}`,
    );
  }
}
