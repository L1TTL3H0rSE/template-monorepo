// Vue-примитивы импортируются ЯВНО, хотя Nuxt их авто-импортирует.
//
// Причина в тестируемости: стор — чистая логика, и его юнит-тест должен
// запускаться в обычном Node-окружении, без слоя авто-импортов Nuxt. Явный
// импорт ничего не ломает в рантайме и снимает скрытую зависимость от сборщика.
import { computed, onScopeDispose, ref, watch } from "vue";
import { defineStore } from "pinia";
import { isCancelled } from "@starter/api/core";
import { useOptimisticList, usePagination } from "@starter/shared/data";
import { useSearchQuery } from "@starter/shared/search";
import type { Character, CharacterDraft } from "~/contracts/character";
import { useApi } from "~/api/api";

/**
 * Стор списка персонажей.
 *
 * Setup-форма (`defineStore("...", () => {...})`), а не options: она пишется
 * тем же кодом, что и композабл, и позволяет использовать общие композаблы
 * `@starter/shared` прямо внутри стора.
 *
 * Стор владеет состоянием СПИСКА, а не отдельным персонажем. Форму
 * редактирования держит компонент: состояние, живущее ровно столько же, сколько
 * экран, в глобальный стор не выносится.
 */
export const useCharactersStore = defineStore("characters", () => {
  const api = useApi();

  const serverItems = ref<Character[]>([]);
  const pending = ref(false);
  const error = ref<string | null>(null);
  const syncing = ref(false);

  const pagination = usePagination(12);
  const search = useSearchQuery({ minLength: 2 });
  const optimistic = useOptimisticList<Character>((character) => character.id);

  // Компоненты читают items, а не serverItems: локальные правки уже наложены.
  const items = computed(() => optimistic.merge(serverItems.value));

  // Поколение чтения и контроллер текущего запроса.
  //
  // Нужны ОБА, и это не избыточность. Отмена — оптимизация: она освобождает
  // соединение и не даёт устаревшему ответу дойти. Поколение — гарантия: даже
  // если транспорт отмену не поддержал или отмена проиграла гонку, устаревший
  // ответ не сможет записать состояние.
  //
  // Отмены без поколения недостаточно: `AbortController` не отменяет уже
  // разрешившийся промис.
  let loadGeneration = 0;
  let loadController: AbortController | undefined;

  async function load(): Promise<void> {
    const generation = ++loadGeneration;

    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;

    pending.value = true;
    error.value = null;

    try {
      const page = await api.characters.search(
        {
          query: search.applied.value || undefined,
          limit: pagination.perPage.value,
          offset: pagination.offset.value,
        },
        { signal: controller.signal },
      );

      if (generation !== loadGeneration) return;

      serverItems.value = page.items;
      pagination.setTotal(page.total);
    } catch (caught) {
      // Устаревшее чтение молчит: его ошибка относится к состоянию, которое
      // пользователь уже сменил.
      if (generation !== loadGeneration) return;
      // Отмена — не отказ. Показать её как ошибку означает мигать
      // «Сервис недоступен» на каждом нажатии клавиши в поиске.
      if (isCancelled(caught) || controller.signal.aborted) return;

      error.value =
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить список";
      serverItems.value = [];
    } finally {
      // Индикатор снимает только актуальное чтение: иначе отменённый запрос
      // погасит загрузку, которая всё ещё идёт.
      if (generation === loadGeneration) pending.value = false;
    }
  }

  /**
   * Новый поисковый запрос обязан выполнить РОВНО ОДНО чтение.
   *
   * Наивная пара `pagination.reset(); load();` даёт два запроса, когда
   * пользователь находится не на первой странице: сброс страницы будит
   * наблюдателя за `pagination.page`, и тот запускает своё чтение.
   *
   * Второй запрос не просто лишний — он стартует с теми же параметрами и
   * гарантированно отменяет первый, из-за чего в devtools видно «отменённый»
   * запрос при каждом поиске.
   */
  watch(search.applied, () => {
    if (pagination.page.value === 1) {
      void load();
      return;
    }

    // Сброс страницы разбудит наблюдателя ниже, и чтение выполнит он.
    pagination.reset();
  });
  watch(pagination.page, () => void load());

  /**
   * Дождаться, пока сервер догонит запись, и снять оверлей.
   *
   * `await load()` сразу после мутации — антипаттерн: между записью и её
   * появлением в выдаче стоит асинхронный конвейер, и немедленный запрос
   * почти всегда возвращает список БЕЗ изменения.
   */
  async function reconcile(
    key: string,
    isConsistent: () => Promise<boolean>,
  ): Promise<void> {
    syncing.value = true;
    try {
      await optimistic.confirm(key, isConsistent);
      await load();
    } finally {
      syncing.value = false;
    }
  }

  async function create(draft: CharacterDraft): Promise<Character> {
    const created = await api.characters.create(draft);

    // Запись показывается немедленно — до того, как она появится в выдаче.
    optimistic.trackAdd(created);
    pagination.setTotal(pagination.total.value + 1);

    // Опрос идёт фоном: интерфейс не блокируется ожиданием конвейера.
    void reconcile(created.id, async () => {
      const page = await api.characters.search({
        query: created.name,
        limit: 20,
        offset: 0,
      });

      return page.items.some((item) => item.id === created.id);
    });

    return created;
  }

  async function remove(id: string): Promise<void> {
    await api.characters.remove(id);

    optimistic.trackRemove(id);
    pagination.setTotal(Math.max(0, pagination.total.value - 1));

    void reconcile(id, async () => {
      const page = await api.characters.search({
        limit: pagination.perPage.value,
        offset: pagination.offset.value,
      });

      return !page.items.some((item) => item.id === id);
    });
  }

  // Уход со страницы не должен оставлять чтение в полёте: ответ уже никому не
  // нужен, а соединение занято.
  onScopeDispose(() => loadController?.abort());

  return {
    items,
    pending,
    syncing,
    error,
    pagination,
    search,
    load,
    create,
    remove,
  };
});
