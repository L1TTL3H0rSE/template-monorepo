// Инициализация нового проекта из шаблона.
//
//   node scripts/init-project.mjs \
//     --display-name "Acme" \
//     --slug acme \
//     --repository-name acme-platform \
//     --npm-scope @acme \
//     --go-module-prefix github.com/acme/acme-platform
//
// Флаги:
//   --dry-run  ничего не менять, показать список файлов и категории замен;
//   --force    разрешить грязное рабочее дерево (и только это).
//
// Повторная инициализация запрещена всегда и флагом не снимается — см.
// assertNotInitialized.
//
// Скрипт заменяет ТОЛЬКО идентичность проекта. Демонстрационные домены
// (gotemplate, example, character) остаются рабочим кодом: они удаляются
// осознанно, когда появится настоящий вертикальный срез — см. docs/TEMPLATE.md.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

/** Каталог предложений шаблона и его строка в индексе документации. */
const PROPOSALS_DIR = "docs/proposals";
const PROPOSALS_INDEX_ROW =
  "| [`proposals/`](proposals/) | Идеи, зафиксированные, но ещё не принятые |";

main();

function main() {
  const options = parseArguments(process.argv.slice(2));
  const metadata = readTemplateMetadata(ROOT);

  assertNotInitialized(metadata);
  assertCleanWorkingTree(options);

  const target = validateIdentity(options);
  const replacements = buildReplacements(metadata.sourceIdentity, target);

  const files = collectTextFiles(ROOT).filter(
    (file) =>
      // Метаданные шаблона обновляются программно: sourceIdentity в них обязан
      // пережить замену, иначе проверка остатков потеряет эталон для сравнения.
      file !== TEMPLATE_METADATA_FILE &&
      // Предложения удаляются целиком ниже. Заменять в них идентичность незачем,
      // а в отчёте они выглядели бы как изменённые файлы, которых уже нет.
      !file.startsWith(PROPOSALS_DIR + "/"),
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
    console.log("\n--dry-run: дерево не изменено. При обычном запуске docs/proposals/ удаляется.");
    return;
  }

  removeProposals();
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

/**
 * Повторная инициализация запрещена ВСЕГДА — её не снимает даже `--force`.
 *
 * Причина не в осторожности, а в том, что вторая инициализация не может
 * сработать правильно по построению:
 *
 *  1. Замены строятся из `sourceIdentity`, то есть из идентичности ШАБЛОНА.
 *     После первой инициализации исходных токенов в дереве уже нет, поэтому
 *     второй запуск ничего не переименует — но запишет новую идентичность в
 *     метаданные. Результат: файлы говорят «Acme», метаданные — «Beta».
 *  2. Проверка остатков этого не заметит: она тоже ищет только исходные токены.
 *  3. `splitProjectMemory()` выполнит `PROJECT_MEMORY -> TEMPLATE_MEMORY`
 *     повторно и затрёт унаследованную память уже накопленной памятью проекта.
 *
 * Переименование существующего проекта — отдельная задача с другой семантикой,
 * и делать её наполовину хуже, чем не делать вовсе.
 */
function assertNotInitialized(metadata) {
  if (!metadata.initialized) return;

  fail(
    `${TEMPLATE_METADATA_FILE}: initialized уже true.\n` +
      "Повторная инициализация не поддерживается и не снимается флагом --force: " +
      "замены строятся из идентичности шаблона, которой в дереве уже нет, " +
      "поэтому второй запуск переписал бы только метаданные.\n" +
      "Переименование существующего проекта делается отдельно и осознанно.",
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
        "будет отделить от ваших правок. Закоммитьте изменения или передайте " +
        "--force, если готовы разбирать смешанный diff.",
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
 * Удаляет предложения шаблона.
 *
 * `docs/proposals/` — план развития САМОГО шаблона: идеи, которые зафиксированы,
 * но не приняты. Проекту они достаются как чужой список задач: разбирать его
 * никто не станет, а устаревать он начнёт с первого изменения стека.
 *
 * Принятые решения наследуются другим путём — через ADR и `ADOPTION.md`, где у
 * каждого есть статус и обязательный пересмотр. У предложения статуса нет,
 * поэтому и наследовать нечего.
 */
function removeProposals() {
  const directory = join(ROOT, PROPOSALS_DIR);
  if (!existsSync(directory)) return;

  rmSync(directory, { recursive: true });

  // Строка индекса убирается вместе с каталогом: битая ссылка в docs/README.md
  // хуже отсутствующей строки — её открывают и считают, что документ потеряли.
  const index = join(ROOT, "docs/README.md");
  const content = readFileSync(index, "utf8");

  if (!content.includes(PROPOSALS_INDEX_ROW)) {
    fail(
      `docs/README.md: строка индекса для ${PROPOSALS_DIR}/ не найдена — ` +
        "обновите PROPOSALS_INDEX_ROW в scripts/init-project.mjs, иначе " +
        "инициализация оставит ссылку на удалённый каталог.",
    );
  }

  writeFileSync(
    index,
    content.replace(PROPOSALS_INDEX_ROW + "\n", ""),
    "utf8",
  );

  console.log(`предложения: ${PROPOSALS_DIR}/ удалён, строка индекса убрана`);
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

  // Пересмотра требуют только ДЕЙСТВУЮЩИЕ решения. Отменённое или замещённое
  // решение шаблона не может стать решением проекта: «принять» его нечего.
  // Такие ADR остаются в таблице справочно — они объясняют, почему действующее
  // решение выглядит именно так.
  const active = rows.filter((row) => row.status === "accepted");
  const historical = rows.filter((row) => row.status !== "accepted");

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
    "## Требуют пересмотра",
    "",
    "| ADR | Решение шаблона | Состояние в проекте | Примечание |",
    "|---|---|---|---|",
    ...active.map(
      (row) => `| [${row.id}](${row.file}) | ${row.title} | pending | |`,
    ),
    "",
  ];

  if (historical.length > 0) {
    lines.push(
      "## Справочно: недействующие решения шаблона",
      "",
      "Пересмотра не требуют — принимать нечего. Оставлены, потому что",
      "объясняют, почему действующие решения выглядят именно так.",
      "",
      "| ADR | Решение шаблона | Статус в шаблоне |",
      "|---|---|---|",
      ...historical.map(
        (row) => `| [${row.id}](${row.file}) | ${row.title} | ${row.status} |`,
      ),
      "",
    );
  }

  writeFileSync(join(decisionsDir, "ADOPTION.md"), lines.join("\n"), "utf8");
  console.log(
    `ADR: создан ADOPTION.md, ${active.length} решений к пересмотру` +
      (historical.length > 0 ? `, ${historical.length} справочно` : ""),
  );
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
