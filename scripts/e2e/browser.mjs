import assert from "node:assert/strict";

// Настоящий production-сервер и UI: без route.fulfill и подмены API.
export async function smoke(chromium, url, displayName, output, signal) {
  const browser = await chromium.launch({ headless: true });
  const abort = () => { void browser.close(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.goto(url);
      assert.ok((await page.title()).includes(displayName));
      await page.getByRole("link", { name: "Открыть пример" }).click();
      await page.getByRole("heading", { name: "Эйра Полуночная" }).waitFor();
      await page.getByRole("button", { name: "Создать", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Имя", { exact: true }).fill("Сквозной персонаж");
      await dialog.getByRole("button", { name: "Создать", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.getByRole("heading", { name: "Сквозной персонаж", exact: true }).waitFor();
      await page.getByPlaceholder("Поиск по имени").fill("Сквозной");
      await page.getByRole("heading", { name: "Эйра Полуночная" }).waitFor({ state: "hidden" });
      assert.equal(await page.getByRole("button", { name: "Удалить", exact: true }).count(), 1);
      await page.screenshot({ path: `${output}-${viewport.width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Удалить", exact: true }).click();
      await page.getByText("Ничего не найдено.", { exact: true }).waitFor();
      await page.reload();
      // Mock хранит записи в памяти: reload восстанавливает исходную фикстуру.
      await page.getByRole("heading", { name: "Эйра Полуночная" }).waitFor();
      assert.equal(await page.getByRole("heading", { name: "Сквозной персонаж", exact: true }).count(), 0);
      assert.deepEqual(errors, [], "ошибки браузера");
      await context.close();
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await browser.close();
  }
}
