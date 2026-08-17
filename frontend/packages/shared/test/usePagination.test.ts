import { describe, expect, it } from "vitest";
import { usePagination } from "../src/data/usePagination";

describe("usePagination", () => {
  it("считает offset от текущей страницы", () => {
    const pagination = usePagination(10);
    pagination.setTotal(100);

    expect(pagination.offset.value).toBe(0);

    pagination.next();

    expect(pagination.page.value).toBe(2);
    expect(pagination.offset.value).toBe(10);
  });

  it("не уходит за границы выдачи", () => {
    const pagination = usePagination(10);
    pagination.setTotal(15);

    pagination.next();
    pagination.next();
    pagination.next();

    expect(pagination.page.value).toBe(2);
    expect(pagination.canNext.value).toBe(false);
  });

  // Регрессия: после удаления записей текущая страница может оказаться за
  // границей выдачи, и пользователь увидит пустой список без объяснения.
  it("подтягивает страницу назад при уменьшении total", () => {
    const pagination = usePagination(10);
    pagination.setTotal(100);
    pagination.next();
    pagination.next();

    expect(pagination.page.value).toBe(3);

    pagination.setTotal(5);

    expect(pagination.page.value).toBe(1);
  });

  it("оставляет страницу 1 при пустой выдаче", () => {
    const pagination = usePagination(10);

    pagination.setTotal(0);

    expect(pagination.page.value).toBe(1);
    expect(pagination.totalPages.value).toBe(0);
    expect(pagination.canNext.value).toBe(false);
  });
});
