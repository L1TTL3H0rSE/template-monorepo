// Тесты замены идентичности.
//
//   node --test scripts/template-identity.test.mjs
//
// Замена идентичности выполняется один раз на проект и правит сотни файлов.
// Ошибка в ней обнаруживается уже после того, как результат закоммичен, поэтому
// правила проверяются здесь, а не на живом дереве.
//
// ВАЖНО: фикстуры намеренно СИНТЕТИЧЕСКИЕ и не совпадают с идентичностью этого
// шаблона. Иначе инициализация проекта переписала бы сам тест — фикстуры стали
// бы идентичностью нового проекта, а утверждения перестали бы соответствовать
// сценариям, — и в потомке тест падал бы, ничего при этом не проверяя.
// Алгоритму конкретные строки безразличны.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyReplacements,
  buildReplacements,
  containsToken,
  residueTokens,
} from "./template-identity.mjs";

const SOURCE = {
  displayName: "Sample",
  slug: "sample",
  repositoryName: "sample-repo",
  npmScope: "@sample",
  goModulePrefix: "sample",
};

const TARGET = {
  displayName: "Acme",
  slug: "acme",
  repositoryName: "acme-platform",
  npmScope: "@acme",
  goModulePrefix: "github.com/acme/acme-platform",
};

function replace(content, target = TARGET) {
  return applyReplacements(content, buildReplacements(SOURCE, target)).result;
}

test("npm-скоуп не превращается в путь", () => {
  assert.equal(
    replace('"@sample/components": "workspace:*"'),
    '"@acme/components": "workspace:*"',
  );
});

test("Go-модуль получает полный префикс", () => {
  assert.equal(
    replace('import "sample/gotemplate/internal/app"'),
    'import "github.com/acme/acme-platform/gotemplate/internal/app"',
  );
});

test("имя репозитория не разбирается на slug", () => {
  assert.equal(replace("sample-repo"), "acme-platform");
});

test("брендинг заменяется отдельно от slug", () => {
  assert.equal(replace("# Sample"), "# Acme");
});

// Регрессия: последовательные split/join каскадят — уже вставленный
// `@my-sample` попадал под следующее правило `sample -> acme` и становился
// `@my-acme`, расходясь с тем, что записано в .template.json.
test("вставленный результат не попадает под следующее правило", () => {
  assert.equal(
    replace('"@sample/api"', { ...TARGET, npmScope: "@my-sample" }),
    '"@my-sample/api"',
  );
});

test("цель, содержащая исходный slug, переживает замену целиком", () => {
  const target = {
    displayName: "Sample Next",
    slug: "sample-next",
    repositoryName: "sample-next",
    npmScope: "@sample-next",
    goModulePrefix: "example.com/sample-next",
  };

  assert.equal(
    replace('"@sample/shared" и Sample', target),
    '"@sample-next/shared" и Sample Next',
  );
});

// Регрессия: голый slug без границ вырезает подстроку из чужих слов.
test("голый slug не режет слова", () => {
  assert.equal(replace("resampling и samples"), "resampling и samples");
  assert.equal(replace("sample сам по себе"), "acme сам по себе");
});

test("границей считается любой не-алфанумерик", () => {
  assert.equal(replace("(sample)"), "(acme)");
  assert.equal(replace("sample_service"), "acme_service");
});

test("совпадающие значения не порождают правил", () => {
  assert.equal(buildReplacements(SOURCE, { ...SOURCE }).length, 0);
});

test("правила отсортированы от длинного к короткому", () => {
  const lengths = buildReplacements(SOURCE, TARGET).map(
    (rule) => rule.from.length,
  );

  assert.deepEqual(lengths, [...lengths].sort((a, b) => b - a));
});

/**
 * Ключевой инвариант: замена и проверка остатков обязаны использовать ОДНО
 * правило. Асимметрия делает checker навсегда красным на правильно
 * инициализированном дереве — или, в обратную сторону, слепым к тому, что
 * замена пропустила.
 */
test("проверка остатков видит ровно то, что заменяет замена", () => {
  const samples = [
    "@sample/components",
    'import "sample/kit/ginx"',
    "sample-repo",
    "# Sample",
    "sample сам по себе",
    "resampling и samples",
    "ничего похожего",
  ];

  for (const content of samples) {
    const changed = replace(content) !== content;
    const hasResidue = residueTokens(SOURCE).some((rule) =>
      containsToken(content, rule),
    );

    assert.equal(
      hasResidue,
      changed,
      `"${content}": замена ${changed ? "" : "не "}сработала, ` +
        `а проверка ${hasResidue ? "" : "не "}нашла остаток`,
    );
  }
});

test("после замены остатков не остаётся", () => {
  const replaced = replace(
    '"@sample/api" + sample/kit + sample-repo + Sample + sample',
  );
  const residue = residueTokens(SOURCE).filter((rule) =>
    containsToken(replaced, rule),
  );

  assert.deepEqual(residue, []);
});
