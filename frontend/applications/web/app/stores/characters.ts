import { defineStore } from "pinia";
import { useOptimisticList, usePagination } from "@roleplay/shared/data";
import { useSearchQuery } from "@roleplay/shared/search";
import type { Character, CharacterDraft } from "~/contracts/character";
import { useApi } from "~/api/api";

/**
 * Стор списка персонажей.
 *
 * Setup-форма (`defineStore("...", () => {...})`), а не options: она пишется
 * тем же кодом, что и композабл, и позволяет использовать общие композаблы
 * `@roleplay/shared` прямо внутри стора.
 *
 * Стор владеет состоянием СПИСКА, а не отдельным персонажем. Форму
 * редактирования держит компонент: состояние, живущее ровно столько же, сколько
 * экран, в глобальный стор не выносится — иначе возврат на страницу показывает
 * чужие данные.
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

  async function load(): Promise<void> {
    pending.value = true;
    error.value = null;

    try {
      const page = await api.characters.search({
        query: search.applied.value || undefined,
        limit: pagination.perPage.value,
        offset: pagination.offset.value,
      });

      serverItems.value = page.items;
      pagination.setTotal(page.total);
    } catch (caught) {
      error.value =
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить список";
      serverItems.value = [];
    } finally {
      pending.value = false;
    }
  }

  // Новый поисковый запрос всегда возвращает на первую страницу: иначе
  // пользователь ищет и попадает на страницу 5 пустой выдачи.
  watch(search.applied, () => {
    pagination.reset();
    void load();
  });
  watch(pagination.page, () => void load());

  /**
   * Дождаться, пока сервер догонит запись, и снять оверлей.
   *
   * `await load()` сразу после мутации — антипаттерн: между записью и её
   * появлением в выдаче стоит асинхронный конвейер, и немедленный запрос
   * почти всегда возвращает список БЕЗ изменения. Пользователь видит, что
   * действие не сработало, и повторяет его.
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
