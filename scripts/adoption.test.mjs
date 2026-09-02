// Тесты таблицы принятия унаследованных ADR.
//
//   node --test scripts/adoption.test.mjs
//
// Проверяется поведение, которое защищает инициализацию, а не то, что регулярка
// что-то вернула: действующий ADR без условия пересмотра обязан останавливать
// генерацию, иначе потомок получает строку `pending` без события — неотличимую
// от забытой.
//
// Фикстуры СИНТЕТИЧЕСКИЕ и не совпадают с ADR этого репозитория: иначе замена
// идентичности или правка настоящего решения переписала бы сам тест.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAdoptionDocument, parseDecision } from "./adoption.mjs";

function adr({ id, title, status, trigger }) {
  const header = [
    `# ADR-${id}: ${title}`,
    "",
    `- **Статус:** ${status}`,
    "- **Область:** `demo/*`",
  ];
  if (trigger) header.push(`- **Пересмотр в потомке:** ${trigger}`);

  return { file: `${id}-demo.md`, content: [...header, "", "## Контекст"].join("\n") };
}

function build(sources) {
  return buildAdoptionDocument(
    sources.map(({ file, content }) => parseDecision(file, content)),
  );
}

const VALID = adr({
  id: "0001",
  title: "Демонстрационное решение",
  status: "accepted",
  trigger: "появился второй сервис",
});

test("действующее решение с условием попадает в таблицу вместе с условием", () => {
  const document = build([VALID]);

  assert.deepEqual(document.missingTriggers, []);
  assert.equal(document.activeCount, 1);
  assert.match(
    document.markdown,
    /\| \[0001\]\(0001-demo\.md\) \| Демонстрационное решение \| pending \| появился второй сервис \|/,
  );
});

// Представительное нарушение. Без этого теста guard мог бы молча пропускать
// пустое условие — и проверка была бы зелёной ни на чём.
test("действующее решение без условия останавливает генерацию", () => {
  const document = build([
    VALID,
    adr({ id: "0002", title: "Забытое решение", status: "accepted" }),
  ]);

  assert.deepEqual(document.missingTriggers, ["0002-demo.md"]);
});

test("пустое условие не считается условием", () => {
  const broken = adr({
    id: "0003",
    title: "Пустое условие",
    status: "accepted",
    trigger: "   ",
  });

  assert.deepEqual(build([broken]).missingTriggers, ["0003-demo.md"]);
});

// Отменённое решение принимать нечего, поэтому условия оно не требует — иначе
// правило заставляло бы дописывать метаданные в исторические файлы.
test("недействующее решение условия не требует и уходит в справочный раздел", () => {
  const document = build([
    VALID,
    adr({ id: "0004", title: "Замещённое решение", status: "superseded" }),
  ]);

  assert.deepEqual(document.missingTriggers, []);
  assert.equal(document.historicalCount, 1);
  assert.match(document.markdown, /## Справочно: недействующие решения шаблона/);
});

test("условие переносится целиком, включая перенос строки", () => {
  const wrapped = {
    file: "0005-demo.md",
    content: [
      "# ADR-0005: Длинное условие",
      "",
      "- **Статус:** accepted",
      "- **Пересмотр в потомке:** появился гейтвей либо выбран",
      "  провайдер identity",
      "",
      "## Контекст",
    ].join("\n"),
  };

  assert.equal(
    parseDecision(wrapped.file, wrapped.content).trigger,
    "появился гейтвей либо выбран провайдер identity",
  );
});

// Таблица описывает УНАСЛЕДОВАННЫЕ решения. Собственные ADR проекта условия
// пересмотра в потомке не требуют, и сгенерированный документ обязан это
// говорить — иначе требование шаблона протекает в обычное управление проектом.
test("документ явно освобождает собственные ADR проекта от условия", () => {
  assert.match(
    build([VALID]).markdown,
    /Собственные ADR этого проекта[\s\S]*условия пересмотра\s*\n?в потомке не требуют/,
  );
});
