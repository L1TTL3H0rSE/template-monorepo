import { shallowReactive } from "vue";
import { probeUntil, type ProbeOptions } from "./probeUntil";

export type OptimisticList<T> = {
  /** Наложить серверную выдачу на локальные правки. */
  merge: (serverItems: readonly T[]) => T[];
  /** Показать созданную запись до её появления в выдаче. */
  trackAdd: (item: T) => void;
  /** Скрыть удалённую запись до её исчезновения из выдачи. */
  trackRemove: (key: string) => void;
  /** Снять локальную правку: сервер согласован либо бюджет исчерпан. */
  settle: (key: string) => void;
  /** Снять все локальные правки. */
  reset: () => void;
  /**
   * Опрашивать `check`, пока он не подтвердит согласованность, затем снять
   * оверлей. Возвращает `false`, если бюджет исчерпан.
   */
  confirm: (
    key: string,
    check: () => Promise<boolean>,
    options?: ProbeOptions,
  ) => Promise<boolean>;
  /** Есть ли неподтверждённые правки — для индикатора «синхронизируется». */
  hasPending: () => boolean;
};

/**
 * Оптимистичный оверлей поверх серверного списка.
 *
 * Задача. Между записью и её появлением в выдаче стоит асинхронный конвейер
 * (БД → шина → индекс). Привычная последовательность
 *
 *     await api.create(draft);
 *     await load();            // <- антипаттерн
 *
 * почти всегда возвращает список БЕЗ созданной записи: `load()` успевает
 * раньше конвейера. Пользователь видит, что действие «не сработало»,
 * нажимает ещё раз — и создаёт дубликат.
 *
 * Решение: показать результат сразу локально, а согласованность подтвердить
 * ограниченным опросом. Оверлей снимается, когда сервер догнал, либо когда
 * бюджет опроса исчерпан — во втором случае вызывающий может показать
 * «изменения появятся через несколько секунд», а не соврать пользователю.
 *
 * Дубликата при слиянии не возникает: запись, уже пришедшая с сервера,
 * вытесняет свой оверлей по ключу.
 */
export function useOptimisticList<T>(
  getKey: (item: T) => string,
): OptimisticList<T> {
  // shallowReactive, а не ref(new Map()): реактивна сама коллекция
  // (add/delete), а хранимые элементы остаются нетронутыми значениями. `ref`
  // применил бы к ним UnwrapRef и подменил бы тип T на его развёрнутую версию —
  // для generic-контейнера это ломает типизацию без всякой пользы.
  const added = shallowReactive(new Map<string, T>());
  const removed = shallowReactive(new Set<string>());

  function merge(serverItems: readonly T[]): T[] {
    const serverKeys = new Set(serverItems.map(getKey));

    // Оверлей идёт первым: только что созданная запись должна быть видна
    // сразу, а не на третьей странице, куда её поставит серверная сортировка.
    const overlay = [...added.values()].filter(
      (item) => !serverKeys.has(getKey(item)),
    );

    return [...overlay, ...serverItems].filter(
      (item) => !removed.has(getKey(item)),
    );
  }

  function settle(key: string): void {
    added.delete(key);
    removed.delete(key);
  }

  async function confirm(
    key: string,
    check: () => Promise<boolean>,
    options?: ProbeOptions,
  ): Promise<boolean> {
    const consistent = await probeUntil(check, options);

    // Оверлей снимается в ЛЮБОМ исходе. Оставленный навсегда, он показывает
    // запись, которой на сервере может уже не быть, — и расходится с
    // реальностью тем сильнее, чем дольше открыта вкладка.
    settle(key);

    return consistent;
  }

  return {
    merge,
    trackAdd: (item) => {
      added.set(getKey(item), item);
    },
    trackRemove: (key) => {
      removed.add(key);
    },
    settle,
    reset: () => {
      added.clear();
      removed.clear();
    },
    confirm,
    hasPending: () => added.size > 0 || removed.size > 0,
  };
}
