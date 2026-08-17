export type ProbeOptions = {
  /** Максимум попыток. По умолчанию 5. */
  attempts?: number;
  /** Задержка перед первой повторной попыткой, мс. По умолчанию 150. */
  initialDelayMs?: number;
  /** Множитель задержки. По умолчанию 2. */
  factor?: number;
  /** Потолок задержки, мс. По умолчанию 2000. */
  maxDelayMs?: number;
  /** Прервать опрос досрочно. */
  signal?: AbortSignal;
};

/**
 * Ограниченный опрос с экспоненциальной задержкой: вызывает `check`, пока он не
 * вернёт `true` либо пока не кончится бюджет попыток.
 *
 * Зачем это нужно. Между записью и её появлением в выдаче стоит асинхронный
 * конвейер: БД → шина → индекс поиска. `POST /create` возвращает 200, когда
 * запись легла в БД, — но список ещё не знает о ней. Немедленный повторный
 * запрос списка возвращает выдачу БЕЗ созданной записи, и пользователь видит,
 * что «ничего не создалось».
 *
 * Почему опрос ОГРАНИЧЕН. Бесконечный retry превращает временную деградацию
 * конвейера в шторм запросов от каждой открытой вкладки. Исчерпание бюджета —
 * штатный исход: возвращается `false`, и вызывающий решает, что показать.
 *
 * Возвращает `true`, если условие выполнилось; `false` — если бюджет исчерпан
 * или опрос прерван.
 */
export async function probeUntil(
  check: () => Promise<boolean>,
  options: ProbeOptions = {},
): Promise<boolean> {
  const {
    attempts = 5,
    initialDelayMs = 150,
    factor = 2,
    maxDelayMs = 2000,
    signal,
  } = options;

  let delay = initialDelayMs;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) return false;

    try {
      if (await check()) return true;
    } catch {
      // Сбой одной попытки не прекращает опрос: конвейер мог быть недоступен
      // ровно на время этого запроса. Бюджет попыток при этом расходуется,
      // поэтому недоступность не даёт бесконечного цикла.
    }

    // После последней попытки ждать бессмысленно.
    if (attempt === attempts - 1) break;

    await sleep(delay, signal);
    delay = Math.min(delay * factor, maxDelayMs);
  }

  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);

    // Таймер снимается при отмене: иначе прерванный опрос продолжает держать
    // отложенный вызов после ухода со страницы.
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
