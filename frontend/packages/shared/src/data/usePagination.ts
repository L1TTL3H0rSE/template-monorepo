import { computed, ref, type ComputedRef, type Ref } from "vue";

export type Pagination = {
  page: Ref<number>;
  perPage: Ref<number>;
  total: Ref<number>;
  offset: ComputedRef<number>;
  totalPages: ComputedRef<number>;
  canPrevious: ComputedRef<boolean>;
  canNext: ComputedRef<boolean>;
  setTotal: (value: number) => void;
  next: () => void;
  previous: () => void;
  reset: () => void;
};

/**
 * Состояние страничной навигации.
 *
 * `total` приходит от сервера и НЕ вычисляется из длины загруженного массива:
 * массив содержит одну страницу, поэтому «всего» из него не выводится.
 *
 * Пагинация, фильтр и сортировка остаются за границей API. Загружать весь
 * набор и резать его в браузере — решение, которое работает на демо-данных и
 * ломается на реальных.
 */
export function usePagination(initialPerPage = 20): Pagination {
  const page = ref(1);
  const perPage = ref(initialPerPage);
  const total = ref(0);

  const offset = computed(() => (page.value - 1) * perPage.value);
  const totalPages = computed(() =>
    perPage.value > 0 ? Math.ceil(total.value / perPage.value) : 0,
  );
  const canPrevious = computed(() => page.value > 1);
  const canNext = computed(() => page.value < totalPages.value);

  return {
    page,
    perPage,
    total,
    offset,
    totalPages,
    canPrevious,
    canNext,
    setTotal: (value) => {
      total.value = value;
      // Удаление последних элементов может оставить страницу за границей
      // выдачи; без этого пользователь видит пустой список без объяснения.
      if (page.value > totalPages.value) {
        page.value = Math.max(1, totalPages.value);
      }
    },
    next: () => {
      if (page.value < totalPages.value) page.value += 1;
    },
    previous: () => {
      if (page.value > 1) page.value -= 1;
    },
    reset: () => {
      page.value = 1;
    },
  };
}
