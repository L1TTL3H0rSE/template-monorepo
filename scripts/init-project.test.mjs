// Тесты порядка инициализации.
//
//   node --test scripts/init-project.test.mjs
//
// Проверяется не то, что buildAdoptionDocument возвращает missingTriggers — это
// доказано в adoption.test.mjs, — а СЕМАНТИКА оркестрации: незаполненный ADR
// обязан останавливать инициализацию до первой записи, и `--dry-run` обязан
// сообщать о том же отказе. Предусловие, проверенное после половины мутаций,
// оставляет дерево ни шаблоном, ни проектом, а сухой прогон, не доходящий до
// проверки, отчитывается об успехе там, где настоящий запуск упадёт.
//
// Тест работает на ВРЕМЕННОМ минимальном шаблоне, а не на этом репозитории:
// проверка на живом дереве либо мутирует его, либо доказывает только зелёный
// случай. Фикстура содержит ровно то, что инициализация читает до первой
// записи, плюс файлы-маркеры, по которым видно, что записи не было.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

const SOURCE_IDENTITY = {
  displayName: "Starter",
  slug: "starter",
  repositoryName: "template-monorepo",
  npmScope: "@starter",
  goModulePrefix: "starter",
};

const TARGET_ARGUMENTS = [
  "--display-name", "Acme",
  "--slug", "acme",
  "--repository-name", "acme-platform",
  "--npm-scope", "@acme",
  "--go-module-prefix", "example.com/acme",
  // Фикстура не git-репозиторий; флаг снимает только проверку чистого дерева.
  "--force",
];

function decision(id, { trigger } = {}) {
  const триггер = trigger ? `- **Пересмотр в потомке:** ${trigger}` : "";

  return `# ADR-${id}: Демонстрационное решение ${id}

- **Статус:** accepted
- **Область:** \`demo/*\`
${триггер}

## Контекст
`;
}

function fixture(decisions) {
  const root = mkdtempSync(join(tmpdir(), "init-preflight-"));

  cpSync(SCRIPTS, join(root, "scripts"), { recursive: true });
  writeFileSync(
    join(root, ".template.json"),
    JSON.stringify(
      { schemaVersion: 1, initialized: false, sourceIdentity: SOURCE_IDENTITY, projectIdentity: null },
      null,
      2,
    ),
  );

  mkdirSync(join(root, "docs", "decisions"), { recursive: true });
  for (const [file, content] of Object.entries(decisions)) {
    writeFileSync(join(root, "docs", "decisions", file), content);
  }

  // Маркеры двух мутаций: замены идентичности и разделения памяти.
  writeFileSync(join(root, "docs", "MARKER.md"), "# @starter/web в template-monorepo");
  writeFileSync(join(root, "docs", "PROJECT_MEMORY.md"), "# Память проекта");

  return root;
}

function initialize(root, extra = []) {
  return spawnSync(process.execPath, [join(root, "scripts", "init-project.mjs"), ...TARGET_ARGUMENTS, ...extra], {
    encoding: "utf8",
  });
}

const VALID = { "0001-demo.md": decision("0001", { trigger: "появился второй сервис" }) };
const INVALID = { ...VALID, "0002-demo.md": decision("0002") };

test("валидный набор унаследованных ADR проходит предусловие", (t) => {
  const root = fixture(VALID);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = initialize(root, ["--dry-run"]);

  assert.equal(result.status, 0, `инициализация отклонила валидный шаблон: ${result.stderr}`);
  assert.match(result.stdout, /будут изменены файлы/);
});

test("действующий ADR без условия останавливает инициализацию ДО первой мутации", (t) => {
  const root = fixture(INVALID);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = initialize(root);

  assert.equal(result.status, 1, "инициализация приняла ADR без условия пересмотра");
  assert.match(result.stderr, /Пересмотр в потомке/);
  assert.match(result.stderr, /0002-demo\.md/);

  // Главное утверждение: отказ произошёл раньше любой записи.
  assert.match(
    readFileSync(join(root, "docs", "MARKER.md"), "utf8"),
    /@starter/,
    "идентичность уже заменена: предусловие проверено после мутации",
  );
  assert.ok(existsSync(join(root, "docs", "PROJECT_MEMORY.md")), "память проекта уже разделена");
  assert.ok(!existsSync(join(root, "docs", "TEMPLATE_MEMORY.md")), "память шаблона уже создана");
  assert.ok(!existsSync(join(root, "docs", "decisions", "ADOPTION.md")), "ADOPTION.md записан несмотря на отказ");
});

// Сухой прогон существует, чтобы узнать исход НАСТОЯЩЕГО запуска. Успех там,
// где реальная инициализация остановится, — это не отчёт, а дезинформация.
test("--dry-run сообщает об отказе, а не отчитывается об успехе", (t) => {
  const root = fixture(INVALID);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = initialize(root, ["--dry-run"]);

  assert.equal(result.status, 1, "--dry-run прошёл на шаблоне, который настоящий запуск отвергает");
  assert.match(result.stderr, /Пересмотр в потомке/);
});

// То же правило для второй статической предпосылки. Здесь оно строже: без этой
// проверки инициализация останавливалась бы уже ПОСЛЕ удаления каталога.
test("нарушенная раскладка шаблона отвергается до удаления и до замен", (t) => {
  const root = fixture(VALID);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  // Каталог предложений есть, а строки индекса, которую убирает инициализация,
  // в docs/README.md нет.
  mkdirSync(join(root, "docs", "proposals"));
  writeFileSync(join(root, "docs", "proposals", "idea.md"), "# Идея");
  writeFileSync(join(root, "docs", "README.md"), "# Документация");

  const result = initialize(root);

  assert.equal(result.status, 1, "инициализация приняла шаблон с битым индексом");
  assert.match(result.stderr, /строка индекса/);
  assert.ok(
    existsSync(join(root, "docs", "proposals", "idea.md")),
    "предложения удалены до того, как отказ состоялся",
  );
  assert.match(
    readFileSync(join(root, "docs", "MARKER.md"), "utf8"),
    /@starter/,
    "идентичность заменена до того, как отказ состоялся",
  );
});
