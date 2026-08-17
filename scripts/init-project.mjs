// Инициализация нового проекта из шаблона.
//
//   node scripts/init-project.mjs \
//     --display-name "Acme" \
//     --slug acme \
//     --repository-name acme-platform \
//     --npm-scope @acme \
//     --go-module-prefix github.com/acme/acme-platform
//
// Флаги: --dry-run (ничего не менять), --force (разрешить грязное дерево).
//
// Скрипт заменяет ТОЛЬКО идентичность проекта. Демонстрационные домены
// (gotemplate, example, character) остаются рабочим кодом: они удаляются
// осознанно, когда появится настоящий вертикальный срез — см. docs/TEMPLATE.md.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyReplacements,
  buildReplacements,
  collectTextFiles,
  readTemplateMetadata,
  TEMPLATE_METADATA_FILE,
} from "./template-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

main();

function main() {
  const options = parseArguments(process.argv.slice(2));
  const metadata = readTemplateMetadata(ROOT);

  assertNotInitialized(metadata, options);
  assertCleanWorkingTree(options);

  const target = validateIdentity(options);
  const replacements = buildReplacements(metadata.sourceIdentity, target);

  const files = collectTextFiles(ROOT).filter(
    // Метаданные шаблона обновляются программно: sourceIdentity в них обязан
    // пережить замену, иначе проверка остатков потеряет эталон для сравнения.
    (file) => file !== TEMPLATE_METADATA_FILE,
  );

  const changed = [];
  const totals = new Map();

  for (const file of files) {
    const absolute = join(ROOT, file);
    const content = readFileSync(absolute, "utf8");
    const { result, counts } = applyReplacements(content, replacements);

    if (result === content) continue;

    changed.push({ file, counts });
    for (const [kind, count] of counts) {
      totals.set(kind, (totals.get(kind) ?? 0) + count);
    }

    if (!options.dryRun) writeFileSync(absolute, result, "utf8");
  }

  report(changed, totals, options);

  if (options.dryRun) {
    console.log("\n--dry-run: дерево не изменено.");
    return;
  }

  splitProjectMemory();
  writeAdoptionTable();
  updateMetadata(metadata, target);
  runResidueCheck();
  printNextSteps(target);
}

// --- аргументы ---

function parseArguments(argv) {
  const options = { dryRun: false, force: false };
  const map = {
    "--display-name": "displayName",
    "--slug": "slug",
    "--repository-name": "repositoryName",
    "--npm-scope": "npmScope",
    "--go-module-prefix": "goModulePrefix",
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    if (map[argument]) {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--")) {
        fail(`${argument} требует значение`);
      }
      options[map[argument]] = value;
      continue;
    }

    fail(`неизвестный аргумент: ${argument}`);
  }

  return options;
}

function validateIdentity(options) {
  const required = [
    "displayName",
    "slug",
    "repositoryName",
    "npmScope",
    "goModulePrefix",
  ];
  const missing = required.filter((field) => !options[field]);
  if (missing.length > 0) {
    fail(`не переданы обязательные аргументы: ${missing.join(", ")}`);
  }

  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(options.npmScope)) {
    fail(
      `--npm-scope должен начинаться с @ и быть допустимым именем npm: ${options.npmScope}`,
    );
  }
  for (const field of ["slug", "repositoryName"]) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(options[field])) {
      fail(`--${kebab(field)} должен быть kebab-case без пробелов и путей`);
    }
  }
  if (/\s/.test(options.goModulePrefix) || options.goModulePrefix === "") {
    fail("--go-module-prefix не должен быть пустым и содержать пробелы");
  }
  if (options.displayName.trim() === "") {
    fail("--display-name не должен быть пустым");
  }

  return {
    displayName: options.displayName,
    slug: options.slug,
    repositoryName: options.repositoryName,
    npmScope: options.npmScope,
    goModulePrefix: options.goModulePrefix,
  };
}

function assertNotInitialized(metadata, options) {
  if (!metadata.initialized) return;
  if (options.force) {
    console.warn("предупреждение: повторная инициализация под --force");
    return;
  }

  fail(
    `${TEMPLATE_METADATA_FILE}: initialized уже true. ` +
      "Повторная инициализация переписала бы уже принадлежащую проекту идентичность. " +
      "Используйте --force осознанно.",
  );
}

function assertCleanWorkingTree(options) {
  if (options.dryRun || options.force) return;

  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch {
    // Не git-репозиторий: проверять нечего.
    return;
  }

  if (status.trim() !== "") {
    fail(
      "рабочее дерево грязное. Инициализация меняет сотни файлов, и её нельзя " +
        "будет отделить от ваших правок. Закоммитьте изменения или используйте --force.",
    );
  }
}

// --- побочные эффекты инициализации ---

/**
 * Разделяет унаследованную память шаблона и память проекта.
 *
 * Факты, проверенные на шаблоне, не должны автоматически считаться
 * проверенными фактами нового проекта: у него другой набор зависимостей,
 * другая инфраструктура и своя история. Но и удалять их нельзя — большинство
 * ловушек тулчейна остаются полезными.
 */
function splitProjectMemory() {
  const inherited = join(ROOT, "docs/PROJECT_MEMORY.md");
  const template = join(ROOT, "docs/TEMPLATE_MEMORY.md");

  renameSync(inherited, template);

  const header = readFileSync(template, "utf8");
  writeFileSync(
    template,
    header.replace(
      "# Память проекта",
      [
        "# Унаследованная память шаблона",
        "",
        "Это память ИСХОДНОГО шаблона, сохранённая при инициализации проекта.",
        "Она является справочным материалом, а не источником истины текущего",
        "проекта: запись переносится в `PROJECT_MEMORY.md` только после",
        "повторной проверки по текущему коду, конфигурации и тестам.",
      ].join("\n"),
    ),
    "utf8",
  );

  writeFileSync(
    inherited,
    [
      "# Память проекта",
      "",
      "Здесь хранятся только подтверждённые факты и ловушки текущего проекта,",
      "которые трудно вывести из одного очевидного файла.",
      "",
      "Унаследованная память исходного шаблона находится в",
      "[`TEMPLATE_MEMORY.md`](TEMPLATE_MEMORY.md). Она является справочным",
      "материалом, а не источником истины текущего проекта. Запись переносится",
      "сюда только после повторной проверки по текущему коду, конфигурации и",
      "тестам.",
      "",
      "Запись содержит идентификатор, область, вывод, источники и дату проверки.",
      "Если код опровергает запись — прав код: исправьте или удалите её в том же",
      "изменении.",
      "",
      "---",
      "",
      "_Пока пусто._",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log("память: PROJECT_MEMORY.md -> TEMPLATE_MEMORY.md, создана новая");
}

/**
 * Генерирует таблицу принятия унаследованных ADR.
 *
 * Принятый ADR шаблона — решение ШАБЛОНА, а не автоматически решение проекта.
 * Без явного пересмотра проект наследует чужие компромиссы, не зная их цены.
 */
function writeAdoptionTable() {
  const decisionsDir = join(ROOT, "docs/decisions");
  const files = readdirSync(decisionsDir)
    .filter((name) => /^\d{4}-.*\.md$/.test(name))
    .sort((a, b) => a.localeCompare(b, "en"));

  const rows = files.map((file) => {
    const content = readFileSync(join(decisionsDir, file), "utf8");
    const titleMatch = content.match(/^#\s*ADR-(\d{4}):\s*(.+)$/m);
    const statusMatch = content.match(/\*\*Статус:\*\*\s*(\S+)/);

    return {
      id: titleMatch?.[1] ?? file.slice(0, 4),
      title: titleMatch?.[2]?.trim() ?? file,
      status: statusMatch?.[1] ?? "unknown",
      file,
    };
  });

  const lines = [
    "# Принятие ADR шаблона",
    "",
    "Принятый ADR шаблона — решение **шаблона**, а не автоматически решение",
    "этого проекта. Пока строка имеет состояние `pending`, соответствующее",
    "решение НЕ считается принятым: базовая архитектура проекта не завершена.",
    "",
    "Допустимые состояния:",
    "",
    "- `adopted` — решение проверено в контексте проекта и принято;",
    "- `superseded by ADR-NNNN` — проект принял другое решение и оформил его",
    "  собственным ADR;",
    "- `pending` — не рассмотрено.",
    "",
    "Состояния `rejected` нет намеренно: унаследованный файл продолжает",
    "утверждать `accepted` и остаётся в дереве. Отказ оформляется новым ADR,",
    "который его замещает.",
    "",
    "| ADR | Решение шаблона | Статус в шаблоне | Состояние в проекте | Примечание |",
    "|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| [${row.id}](${row.file}) | ${row.title} | ${row.status} | pending | |`,
    ),
    "",
  ];

  writeFileSync(join(decisionsDir, "ADOPTION.md"), lines.join("\n"), "utf8");
  console.log(`ADR: создан ADOPTION.md, ${rows.length} решений к пересмотру`);
}

function updateMetadata(metadata, target) {
  const updated = {
    ...metadata,
    initialized: true,
    projectIdentity: target,
  };

  writeFileSync(
    join(ROOT, TEMPLATE_METADATA_FILE),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
}

function runResidueCheck() {
  console.log("\nпроверка остатков исходной идентичности...");
  try {
    execFileSync(
      process.execPath,
      [join(ROOT, "scripts/check-template-residue.mjs")],
      { cwd: ROOT, stdio: "inherit" },
    );
  } catch {
    fail(
      "остались упоминания исходной идентичности — см. вывод выше. " +
        "Исправьте их до продолжения работы.",
    );
  }
}

// --- вывод ---

function report(changed, totals, options) {
  const mode = options.dryRun ? "будут изменены" : "изменены";
  console.log(`${mode} файлы: ${changed.length}`);

  for (const [kind, count] of [...totals].sort(([a], [b]) =>
    a.localeCompare(b, "en"),
  )) {
    console.log(`  ${kind}: ${count} замен`);
  }

  if (options.dryRun) {
    console.log("");
    for (const { file, counts } of changed) {
      console.log(`  ${file} (${[...counts.keys()].sort().join(", ")})`);
    }
  }
}

function printNextSteps(target) {
  console.log(
    [
      "",
      "Инициализация завершена. Обязательные следующие шаги:",
      "",
      "1. Пересмотреть унаследованные решения:",
      "     docs/decisions/ADOPTION.md — база архитектуры не завершена,",
      "     пока есть строки со состоянием pending.",
      "2. Проверить сборку и тесты:",
      "     cd frontend && pnpm install --frozen-lockfile && pnpm build:local \\",
      "       && pnpm lint && pnpm typecheck && pnpm test",
      `     pnpm --filter ${target.npmScope}/web build`,
      "     (cd backend/kit && go build ./... && go vet ./...)",
      "     (cd backend/gotemplate && go build ./... && go vet ./... && go test ./...)",
      "3. Решить судьбу демонстрационных доменов (gotemplate / example /",
      "   character) — см. docs/TEMPLATE.md.",
      "",
    ].join("\n"),
  );
}

function kebab(field) {
  return field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function fail(message) {
  console.error(`init-project: ${message}`);
  process.exit(1);
}
