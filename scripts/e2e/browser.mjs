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
      try {
        await page.goto(url);
        assert.ok((await page.title()).includes(displayName));
        await page.getByRole("link", { name: "Открыть пример" }).click();
        await page.getByRole("heading", { name: "Эйра Полуночная" }).waitFor();
        await page.getByRole("button", { name: "Создать", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("textbox", { name: "Имя", exact: true }).fill("Сквозной персонаж");
        await dialog.getByRole("button", { name: "Создать", exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
        await page.getByRole("heading", { name: "Сквозной персонаж", exact: true }).waitFor();
        await page.getByPlaceholder("Поиск по имени").fill("Сквозной");
        // Исчезновение старой карточки бывает и во время загрузки. Ждём сам
        // отфильтрованный результат, иначе smoke принимает pending за пустой список.
        await page.waitForFunction(() => {
          const names = [...document.querySelectorAll("h5")].map(node => node.textContent?.trim());
          return names.length === 1 && names[0] === "Сквозной персонаж";
        });
        assert.equal(await page.getByRole("button", { name: "Удалить", exact: true }).count(), 1);
        await page.screenshot({ path: `${output}-${viewport.width}.png`, fullPage: true });
        await page.getByRole("button", { name: "Удалить", exact: true }).click();
        await page.getByText("Ничего не найдено.", { exact: true }).waitFor();
        await page.reload();
        // Mock хранит записи в памяти: reload восстанавливает исходную фикстуру.
        await page.getByRole("heading", { name: "Эйра Полуночная" }).waitFor();
        assert.equal(await page.getByRole("heading", { name: "Сквозной персонаж", exact: true }).count(), 0);
        assert.deepEqual(errors, [], "ошибки браузера");
      } catch (error) {
        await page.screenshot({ path: `${output}-${viewport.width}-failure.png`, fullPage: true }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await browser.close();
  }
}
