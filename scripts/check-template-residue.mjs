// Проверка остатков исходной идентичности шаблона.
//
//   node scripts/check-template-residue.mjs
//
// До инициализации проверяет только внутреннюю согласованность метаданных.
// После инициализации падает, если где-то остались имена исходного шаблона.
//
// Это проверка обслуживания шаблона, а не общий линтер: она знает ровно одну
// вещь — идентичность из .template.json.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectTextFiles,
  readTemplateMetadata,
  residueTokens,
  TEMPLATE_METADATA_FILE,
} from "./template-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

main();

function main() {
  const metadata = readTemplateMetadata(ROOT);

  if (!metadata.initialized) {
    verifySourceConsistency(metadata);
    console.log(
      "check-template-residue: проект не инициализирован, метаданные согласованы.",
    );
    return;
  }

  verifyProjectIdentity(metadata);

  const tokens = residueTokens(metadata.sourceIdentity);
  const findings = [];

  for (const file of collectTextFiles(ROOT)) {
    // .template.json намеренно хранит sourceIdentity: это исторические
    // метаданные шаблона и эталон для этой самой проверки. Единственное
    // исключение, и оно не расширяется — широкий ignore-лист превратил бы
    // проверку в декорацию.
    if (file === TEMPLATE_METADATA_FILE) continue;

    const content = readFileSync(join(ROOT, file), "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const { token, kind } of tokens) {
        if (line.includes(token)) {
          findings.push({ file, line: index + 1, kind, token, text: line.trim() });
        }
      }
    });
  }

  if (findings.length === 0) {
    console.log(
      "check-template-residue: остатков исходной идентичности не найдено.",
    );
    return;
  }

  console.error(
    `check-template-residue: найдено ${findings.length} упоминаний исходной идентичности\n`,
  );
  for (const finding of findings) {
    console.error(
      `  ${finding.file}:${finding.line}  [${finding.kind}] ${truncate(finding.text)}`,
    );
  }
  console.error(
    "\nЗамените их на идентичность проекта. Если строка обязана остаться " +
      "(например фикстура теста), задокументируйте причину в docs/TEMPLATE.md " +
      "и внесите точечное исключение осознанным изменением этого скрипта.",
  );
  process.exit(1);
}

function verifySourceConsistency(metadata) {
  const { npmScope, slug, goModulePrefix, repositoryName } =
    metadata.sourceIdentity;

  const problems = [];
  if (!npmScope.startsWith("@")) {
    problems.push(`npmScope "${npmScope}" не начинается с @`);
  }
  if (npmScope !== `@${slug}`) {
    problems.push(`npmScope "${npmScope}" не соответствует slug "${slug}"`);
  }
  if (!repositoryName.startsWith(slug)) {
    problems.push(
      `repositoryName "${repositoryName}" не начинается со slug "${slug}"`,
    );
  }
  if (goModulePrefix.trim() === "") {
    problems.push("goModulePrefix пуст");
  }
  if (metadata.projectIdentity !== null) {
    problems.push("projectIdentity заполнен, но initialized === false");
  }

  if (problems.length > 0) {
    console.error("check-template-residue: метаданные шаблона несогласованны\n");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
}

function verifyProjectIdentity(metadata) {
  if (metadata.projectIdentity) return;

  console.error(
    "check-template-residue: initialized === true, но projectIdentity пуст.",
  );
  process.exit(1);
}

function truncate(text, limit = 120) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
