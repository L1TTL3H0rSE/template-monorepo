// Vue-примитивы импортируются ЯВНО, хотя Nuxt их авто-импортирует.
//
// Причина в тестируемости: стор — чистая логика, и его юнит-тест должен
// запускаться в обычном Node-окружении, без слоя авто-импортов Nuxt. Явный
// импорт ничего не ломает в рантайме и снимает скрытую зависимость от сборщика.
import { isCancelled } from "@starter/api/core";
import { useOptimisticList, usePagination } from "@starter/shared/data";
import { useSearchQuery } from "@starter/shared/search";
import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, shallowReactive, watch } from "vue";

import { useApi } from "~/api/api";
import type { Character, CharacterDraft } from "~/contracts/character";

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
  const loadError = ref<string | null>(null);
  const syncErrors = shallowReactive(new Map<string, string>());
  const reconciles = shallowReactive(new Map<string, AbortController>());
  const syncing = computed(() => reconciles.size > 0);
  const error = computed(
    () => loadError.value ?? Array.from(syncErrors.values()).at(-1) ?? null,
  );

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
  let disposed = false;

  async function load(): Promise<void> {
    if (disposed) {
      return;
    }
    const generation = ++loadGeneration;

    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;

    pending.value = true;
    loadError.value = null;

    try {
      const page = await api.characters.search(
        {
          query: search.applied.value || undefined,
          limit: pagination.perPage.value,
          offset: pagination.offset.value,
        },
        { signal: controller.signal },
      );

      if (generation !== loadGeneration) {
        return;
      }

      serverItems.value = page.items;
      pagination.setTotal(page.total);
    } catch (caught) {
      // Устаревшее чтение молчит: его ошибка относится к состоянию, которое
      // пользователь уже сменил.
      if (generation !== loadGeneration) {
        return;
      }
      // Отмена — не отказ. Показать её как ошибку означает мигать
      // «Сервис недоступен» на каждом нажатии клавиши в поиске.
      if (isCancelled(caught) || controller.signal.aborted) {
        return;
      }

      loadError.value =
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить список";
      serverItems.value = [];
    } finally {
      // Индикатор снимает только актуальное чтение: иначе отменённый запрос
      // погасит загрузку, которая всё ещё идёт.
      if (generation === loadGeneration) {
        pending.value = false;
      }
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
  watch(search.applied, async () => {
    if (pagination.page.value === 1) {
      await load();
      return;
    }

    // Сброс страницы разбудит наблюдателя ниже, и чтение выполнит он.
    pagination.reset();
  });
  watch(pagination.page, load);

  /**
   * Дождаться, пока сервер догонит запись, и снять оверлей.
   *
   * `await load()` сразу после мутации — антипаттерн: между записью и её
   * появлением в выдаче стоит асинхронный конвейер, и немедленный запрос
   * почти всегда возвращает список БЕЗ изменения.
   */
  function reconcile(
    key: string,
    isConsistent: (signal: AbortSignal) => Promise<boolean>,
  ): void {
    reconciles.get(key)?.abort();
    const controller = new AbortController();
    reconciles.set(key, controller);
    syncErrors.delete(key);
    const isCurrent = () => !disposed && reconciles.get(key) === controller;
    async function confirmAndRefresh(): Promise<void> {
      const consistent = await optimistic.confirm(
        key,
        () => isConsistent(controller.signal),
        { signal: controller.signal },
      );
      if (!isCurrent()) {
        return;
      }
      await load();
      if (isCurrent() && !consistent) {
        syncErrors.set(
          key,
          "Изменение сохранено, но обновление списка пока не подтверждено. Обновите список позже.",
        );
      }
    }

    confirmAndRefresh()
      .catch((caught: unknown) => {
        if (isCurrent()) {
          syncErrors.set(
            key,
            caught instanceof Error ? caught.message : String(caught),
          );
        }
      })
      .finally(() => {
        if (reconciles.get(key) === controller) {
          reconciles.delete(key);
        }
      });
  }

  async function create(draft: CharacterDraft): Promise<Character> {
    if (disposed) {
      throw new Error("Стор списка уже закрыт");
    }
    const created = await api.characters.create(draft);
    if (disposed) {
      return created;
    }

    // Запись показывается немедленно — до того, как она появится в выдаче.
    optimistic.trackAdd(created);
    pagination.setTotal(pagination.total.value + 1);

    // Опрос идёт фоном: интерфейс не блокируется ожиданием конвейера.
    reconcile(created.id, async (signal) => {
      const page = await api.characters.search(
        { query: created.name, limit: 20, offset: 0 },
        { signal },
      );

      return page.items.some((item) => item.id === created.id);
    });

    return created;
  }

  async function remove(id: string): Promise<void> {
    if (disposed) {
      return;
    }
    await api.characters.remove(id);
    if (disposed) {
      return;
    }

    optimistic.trackRemove(id);
    pagination.setTotal(Math.max(0, pagination.total.value - 1));

    reconcile(id, async (signal) => {
      const page = await api.characters.search(
        { limit: pagination.perPage.value, offset: pagination.offset.value },
        { signal },
      );

      return !page.items.some((item) => item.id === id);
    });
  }

  // Уход со страницы не должен оставлять чтение в полёте: ответ уже никому не
  // нужен, а соединение занято.
  onScopeDispose(() => {
    disposed = true;
    loadGeneration += 1;
    loadController?.abort();
    for (const controller of reconciles.values()) {
      controller.abort();
    }
    reconciles.clear();
    syncErrors.clear();
    optimistic.reset();
    pending.value = false;
  });

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
