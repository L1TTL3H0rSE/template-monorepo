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
 * Строит упорядоченный список замен.
 *
 * Порядок критичен и не может быть произвольным:
 *
 *  1. `@roleplay/` обязан идти ДО `roleplay/`, иначе scope превратится в
 *     `@github.com/acme/...` — npm-скоуп с путём внутри;
 *  2. `roleplay-website` обязан идти ДО голого `roleplay`, иначе останется
 *     `acme-website` вместо имени репозитория;
 *  3. голый slug идёт последним и подбирает то, что осталось.
 */
export function buildReplacements(source, target) {
  return [
    { from: `${source.npmScope}/`, to: `${target.npmScope}/`, kind: "npm-scope" },
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
    { from: source.slug, to: target.slug, kind: "slug" },
  ].filter((replacement) => replacement.from !== replacement.to);
}

/** Применяет замены к содержимому. Возвращает новый текст и статистику. */
export function applyReplacements(content, replacements) {
  let result = content;
  const counts = new Map();

  for (const { from, to, kind } of replacements) {
    const parts = result.split(from);
    if (parts.length === 1) continue;

    counts.set(kind, (counts.get(kind) ?? 0) + parts.length - 1);
    result = parts.join(to);
  }

  return { result, counts };
}

/** Токены исходной идентичности, наличие которых после инициализации — остаток. */
export function residueTokens(source) {
  return [
    { token: source.npmScope, kind: "npm-scope" },
    { token: `${source.goModulePrefix}/`, kind: "go-module" },
    { token: source.repositoryName, kind: "repository" },
    { token: source.displayName, kind: "display-name" },
    { token: source.slug, kind: "slug" },
  ];
}
