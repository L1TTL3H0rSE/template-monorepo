import {
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef,
} from "vue";

export type AsyncState<T> = {
  data: ShallowRef<T | undefined>;
  error: Ref<unknown>;
  pending: Ref<boolean>;
  execute: () => Promise<T | undefined>;
  reset: () => void;
  dispose: () => void;
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
  loader: (signal: AbortSignal) => Promise<T>,
  options: { immediate?: boolean } = {},
): AsyncState<T> {
  const data = shallowRef<T>();
  const error = ref<unknown>(null);
  const pending = ref(false);

  let currentRun = 0;
  let controller: AbortController | undefined;
  let disposed = false;

  function reset(): void {
    currentRun += 1;
    controller?.abort();
    controller = undefined;
    data.value = undefined;
    error.value = null;
    pending.value = false;
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    reset();
  }

  async function execute(): Promise<T | undefined> {
    if (disposed) {
      return undefined;
    }
    const run = ++currentRun;
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;

    pending.value = true;
    error.value = null;

    try {
      const result = await loader(requestController.signal);

      // Пришёл ответ на устаревший запуск — молча выбрасываем.
      if (run !== currentRun) {
        return undefined;
      }

      data.value = result;

      return result;
    } catch (caught) {
      if (run === currentRun && !requestController.signal.aborted) {
        error.value = caught;
      }

      return undefined;
    } finally {
      if (run === currentRun) {
        pending.value = false;
        controller = undefined;
      }
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  if (options.immediate) {
    execute().catch((caught) => {
      if (!disposed && currentRun === 1) {
        error.value = caught;
      }
    });
  }

  return { data, error, pending, execute, reset, dispose };
}
