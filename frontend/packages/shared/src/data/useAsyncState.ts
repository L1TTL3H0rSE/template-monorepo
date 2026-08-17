import { ref, shallowRef, type Ref, type ShallowRef } from "vue";

export type AsyncState<T> = {
  data: ShallowRef<T | undefined>;
  error: Ref<unknown>;
  pending: Ref<boolean>;
  execute: () => Promise<T | undefined>;
};

/**
 * Состояние одной асинхронной загрузки.
 *
 * Три вещи, ради которых он существует и которые почти всегда забывают писать
 * вручную:
 *
 *  1. `pending` снимается в finally — иначе неудачный запрос оставляет вечный
 *     скелетон;
 *  2. `error` сбрасывается при новом запуске — иначе успешный повтор
 *     показывает старую ошибку;
 *  3. гонка: результат устаревшего запроса игнорируется, поэтому быстрый ввод
 *     в поиске не «моргает» ответом на предыдущий запрос.
 */
export function useAsyncState<T>(
  loader: () => Promise<T>,
  options: { immediate?: boolean } = {},
): AsyncState<T> {
  const data = shallowRef<T>();
  const error = ref<unknown>(null);
  const pending = ref(false);

  let currentRun = 0;

  async function execute(): Promise<T | undefined> {
    const run = ++currentRun;

    pending.value = true;
    error.value = null;

    try {
      const result = await loader();

      // Пришёл ответ на устаревший запуск — молча выбрасываем.
      if (run !== currentRun) return undefined;

      data.value = result;

      return result;
    } catch (caught) {
      if (run === currentRun) error.value = caught;

      return undefined;
    } finally {
      if (run === currentRun) pending.value = false;
    }
  }

  if (options.immediate) void execute();

  return { data, error, pending, execute };
}
