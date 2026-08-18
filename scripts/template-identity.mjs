// Общая логика работы с идентичностью шаблона.
//
// Вынесена в отдельный модуль, потому что у неё два потребителя:
// init-project.mjs (заменяет) и check-template-residue.mjs (ищет остатки).
// Разные списки исключений в этих двух скриптах означали бы, что проверка
// молча не смотрит туда, куда писала инициализация.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export const TEMPLATE_METADATA_FILE = ".template.json";

/** Каталоги, которые не участвуют ни в замене, ни в проверке остатков. */
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  ".nuxt",
  ".output",
  "storybook-static",
  ".pnpm-store",
  "bin",
  "coverage",
]);

/** Расширения текстовых файлов, которые обрабатываются. */
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".vue",
  ".json",
  ".md",
  ".yaml",
  ".yml",
  ".scss",
  ".css",
  ".html",
  ".go",
  ".mod",
  ".sum",
  ".sql",
  ".proto",
  ".sh",
  ".txt",
]);

/** Файлы без расширения или с нестандартным именем, которые всё равно текстовые. */
const TEXT_BASENAMES = new Set([
  ".env.example",
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".dockerignore",
  "Dockerfile",
  "Dockerfile.service",
  "Dockerfile.frontend",
  "go.mod",
  "go.sum",
]);

export function readTemplateMetadata(root) {
  const raw = readFileSync(join(root, TEMPLATE_METADATA_FILE), "utf8");
  const metadata = JSON.parse(raw);

  if (metadata.schemaVersion !== 1) {
    throw new Error(
      `${TEMPLATE_METADATA_FILE}: неизвестный schemaVersion ${metadata.schemaVersion}`,
    );
  }
  for (const field of [
    "displayName",
    "slug",
    "repositoryName",
    "npmScope",
    "goModulePrefix",
  ]) {
    if (!metadata.sourceIdentity?.[field]) {
      throw new Error(
        `${TEMPLATE_METADATA_FILE}: sourceIdentity.${field} отсутствует`,
      );
    }
  }

  return metadata;
}

/** Рекурсивно собирает текстовые файлы репозитория в детерминированном порядке. */
export function collectTextFiles(root) {
  const files = [];

  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name, "en"),
    );

    for (const entry of entries) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;

      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!isTextFile(entry.name)) continue;
      // Пустой и очень большой файл пропускаем: lock-файл проходит, бинарь нет.
      if (statSync(full).size > 32 * 1024 * 1024) continue;

      files.push(full);
    }
  };

  walk(root);

  return files.map((file) => relative(root, file).split(sep).join("/")).sort(
    (a, b) => a.localeCompare(b, "en"),
  );
}

function isTextFile(basename) {
  if (TEXT_BASENAMES.has(basename)) return true;

  return TEXT_EXTENSIONS.has(extname(basename));
}

/**
 * Строит список правил замены, отсортированный от самого длинного шаблона к
 * самому короткому.
 *
 * Длина решает конфликты перекрытия: `@starter/` должен победить `starter/`,
 * а `template-monorepo` — голый `starter`. Явный порядок в массиве для этого
 * ненадёжен: он ломается при первом добавлении поля в идентичность.
 */
export function buildReplacements(source, target) {
  return [
    {
      from: `${source.npmScope}/`,
      to: `${target.npmScope}/`,
      kind: "npm-scope",
    },
    { from: source.npmScope, to: target.npmScope, kind: "npm-scope" },
    {
      from: `${source.goModulePrefix}/`,
      to: `${target.goModulePrefix}/`,
      kind: "go-module",
    },
    {
      from: source.repositoryName,
      to: target.repositoryName,
      kind: "repository",
    },
    { from: source.displayName, to: target.displayName, kind: "display-name" },
    { from: source.slug, to: target.slug, kind: "slug", wholeWord: true },
  ]
    .filter((replacement) => replacement.from !== replacement.to)
    .sort((a, b) => b.from.length - a.from.length);
}

/** Символы, которые считаются частью «слова» при boundary-aware замене. */
const WORD_CHARACTER = /[A-Za-z0-9]/;

/**
 * Применяет замены ОДНИМ проходом по исходному тексту.
 *
 * Последовательные `split().join()` каскадят: уже вставленный результат
 * попадает под следующее правило. Реальный пример — цель `@my-starter` при
 * исходном `@starter`: правило `starter -> acme` превратило бы её в
 * `@my-acme`, причём `.template.json` утверждал бы `@my-starter`, а проверка
 * остатков прошла бы (исходного токена в файле больше нет).
 *
 * Здесь каждая позиция исходного текста обрабатывается ровно один раз, и
 * вставленный текст под следующие правила не попадает.
 *
 * `wholeWord` нужен голому slug: без границ он вырезает подстроку из чужих
 * слов. Границей считается любой не-алфанумерик, поэтому `template-monorepo`
 * и `@starter` остаются достижимыми для своих, более длинных правил.
 */
export function applyReplacements(content, replacements) {
  const counts = new Map();
  let result = "";
  let index = 0;

  outer: while (index < content.length) {
    for (const rule of replacements) {
      if (!content.startsWith(rule.from, index)) continue;
      if (rule.wholeWord && !hasWordBoundaries(content, index, rule.from.length)) {
        continue;
      }

      result += rule.to;
      counts.set(rule.kind, (counts.get(rule.kind) ?? 0) + 1);
      index += rule.from.length;
      continue outer;
    }

    result += content[index];
    index += 1;
  }

  return { result, counts };
}

function hasWordBoundaries(content, start, length) {
  const before = content[start - 1];
  const after = content[start + length];

  return (
    (before === undefined || !WORD_CHARACTER.test(before)) &&
    (after === undefined || !WORD_CHARACTER.test(after))
  );
}

/**
 * Токены исходной идентичности, наличие которых после инициализации — остаток.
 *
 * `wholeWord` обязан совпадать с правилами замены. Асимметрия здесь — не
 * мелочь: если замена пропускает `restarter` как чужое слово, а проверка
 * находит в нём подстроку, checker навсегда красный на корректном дереве. И
 * наоборот — более слабая проверка молча пропустила бы то, что замена не
 * тронула.
 */
export function residueTokens(source) {
  return [
    { token: source.npmScope, kind: "npm-scope" },
    { token: `${source.goModulePrefix}/`, kind: "go-module" },
    { token: source.repositoryName, kind: "repository" },
    { token: source.displayName, kind: "display-name" },
    { token: source.slug, kind: "slug", wholeWord: true },
  ];
}

/** Ищет токен по тем же правилам, по которым его заменяет applyReplacements. */
export function containsToken(line, { token, wholeWord }) {
  if (!wholeWord) return line.includes(token);

  let index = line.indexOf(token);
  while (index !== -1) {
    if (hasWordBoundaries(line, index, token.length)) return true;
    index = line.indexOf(token, index + 1);
  }

  return false;
}
