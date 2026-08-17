import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = resolve(here, "../src/components");

const components = readdirSync(componentsDir)
  .filter((name) => name.endsWith(".vue"))
  .sort((a, b) => a.localeCompare(b, "en"));

/**
 * Ведущий HTML-комментарий в `<template>` превращает компонент с одним
 * элементом в multi-root: комментарий — тоже узел.
 *
 * Последствия тихие и дорогие:
 *
 *  - атрибуты и `class` перестают попадать на корневой элемент (fallthrough
 *    работает только для одного корня);
 *  - `wrapper.attributes()` в тестах возвращает пустоту, и тест «проходит»,
 *    проверяя `undefined === undefined`;
 *  - `$el` указывает не на тот узел.
 *
 * Ни компилятор, ни CSS об этом не сообщают — селекторы `[variant="..."]`
 * просто перестают срабатывать. Поэтому проверка автоматическая: пояснения
 * пишутся в `<script setup>`, а не в начале шаблона.
 */
describe("корень шаблона компонента", () => {
  it.each(components)("%s: <template> не начинается с комментария", (file) => {
    const source = readFileSync(resolve(componentsDir, file), "utf8");
    const templateStart = source.indexOf("<template>");

    expect(templateStart).toBeGreaterThanOrEqual(0);

    const body = source.slice(templateStart + "<template>".length).trimStart();

    expect(
      body.startsWith("<!--"),
      `${file}: перенесите пояснение в <script setup> — ведущий комментарий ` +
        `делает компонент multi-root и ломает передачу атрибутов`,
    ).toBe(false);
  });
});
