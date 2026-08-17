import { onScopeDispose, ref, watch, type Ref } from "vue";

export type SearchQueryOptions = {
  /** Задержка перед применением ввода, мс. */
  debounceMs?: number;
  /** Минимальная длина строки; короче — считается пустым запросом. */
  minLength?: number;
};

export type SearchQuery = {
  /** То, что пользователь печатает прямо сейчас. */
  raw: Ref<string>;
  /** То, что уже пора отправлять в API. */
  applied: Ref<string>;
  clear: () => void;
};

/**
 * Разделяет «что напечатано» и «что применено».
 *
 * Одна общая переменная на оба смысла означает запрос к API на каждый символ.
 * Здесь ввод и применение разведены, а таймер снимается через onScopeDispose:
 * без этого отложенный вызов срабатывает после ухода со страницы и пишет в
 * размонтированный компонент.
 */
export function useSearchQuery(options: SearchQueryOptions = {}): SearchQuery {
  const { debounceMs = 300, minLength = 2 } = options;

  const raw = ref("");
  const applied = ref("");

  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  watch(raw, (value) => {
    clearTimer();

    const normalized = value.trim();
    // Пустой запрос применяется сразу: сброс фильтра не должен ждать задержку.
    if (normalized.length === 0) {
      applied.value = "";
      return;
    }
    if (normalized.length < minLength) return;

    timer = setTimeout(() => {
      applied.value = normalized;
    }, debounceMs);
  });

  onScopeDispose(clearTimer);

  return {
    raw,
    applied,
    clear: () => {
      clearTimer();
      raw.value = "";
      applied.value = "";
    },
  };
}
