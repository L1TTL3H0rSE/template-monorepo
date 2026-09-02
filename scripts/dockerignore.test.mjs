// Тест `.dockerignore`: артефакты исключаются рекурсивно.
//
//   node --test scripts/dockerignore.test.mjs
//
// Дефект, ради которого тест существует, не виден при чтении файла: голое
// `node_modules` выглядит как исключение node_modules, а на деле привязано к
// КОРНЮ контекста сборки. В pnpm-воркспейсе корневого `node_modules` нет, и в
// образ уезжали `frontend/packages/*/node_modules` целиком — вместе с
// симлинками, созданными на хосте. На Windows цель такого симлинка записана
// обратными слешами, и в Linux сборка падала на `Cannot find module`.
//
// Проверяется обе стороны: рабочий файл чист, а представительное нарушение
// (голый шаблон вместо рекурсивного) даёт непустой список. Проверка, у которой
// нет доказанного красного состояния, ничего не гарантирует.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Артефакты, которые в этом репозитории рождаются на любом уровне вложенности,
// а не только в корне. Узкие по смыслу исключения — `backend/<модуль>/bin` —
// сюда не входят намеренно: расширение их до рекурсивных вырезало бы из
// контекста больше, чем артефакты сборки.
const NESTED_ARTIFACTS = [
  "node_modules",
  "dist",
  ".nuxt",
  ".output",
  "storybook-static",
  ".pnpm-store",
];

/** Имена артефактов, исключённые шаблоном, привязанным к корню контекста. */
function rootAnchoredArtifacts(text) {
  const patterns = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return NESTED_ARTIFACTS.filter((name) => patterns.includes(name));
}

/** Имена артефактов, у которых нет рекурсивного исключения. */
function missingRecursive(text) {
  const patterns = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return NESTED_ARTIFACTS.filter((name) => !patterns.includes(`**/${name}`));
}

const dockerignore = readFileSync(join(ROOT, ".dockerignore"), "utf8");

test("артефакты исключены рекурсивно, а не от корня контекста", () => {
  assert.deepEqual(rootAnchoredArtifacts(dockerignore), []);
  assert.deepEqual(missingRecursive(dockerignore), []);
});

test("представительное нарушение делает проверку красной", () => {
  const broken = dockerignore.replace("**/node_modules", "node_modules");

  assert.deepEqual(rootAnchoredArtifacts(broken), ["node_modules"]);
  assert.deepEqual(missingRecursive(broken), ["node_modules"]);
});
