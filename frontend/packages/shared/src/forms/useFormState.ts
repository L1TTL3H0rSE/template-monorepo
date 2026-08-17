import { computed, reactive, ref, type ComputedRef } from "vue";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export type FormState<T extends object> = {
  values: T;
  errors: FieldErrors<T>;
  submitting: ComputedRef<boolean>;
  isDirty: ComputedRef<boolean>;
  setErrors: (next: FieldErrors<T>) => void;
  reset: (next?: T) => void;
  submit: (handler: (values: T) => Promise<void>) => Promise<boolean>;
};

/**
 * Минимальное состояние формы: значения, ошибки полей, флаг отправки.
 *
 * Обязанность, ради которой это не пишут в каждом компоненте заново:
 *
 *  - `submitting` блокирует повторную отправку, поэтому двойной клик не создаёт
 *    две сущности;
 *  - ошибки очищаются перед отправкой, поэтому предыдущая неудача не остаётся
 *    на экране после успеха;
 *  - `isDirty` даёт основание предупредить о несохранённых изменениях.
 *
 * Валидация сюда не входит намеренно: правила описываются схемой (zod) рядом с
 * контрактом домена, а не расползаются по компонентам.
 */
export function useFormState<T extends object>(initial: T): FormState<T> {
  const initialSnapshot = ref(JSON.stringify(initial));
  const values = reactive(structuredClone(initial)) as T;
  const errors = reactive({}) as FieldErrors<T>;
  const submittingFlag = ref(false);

  function setErrors(next: FieldErrors<T>): void {
    for (const key of Object.keys(errors)) {
      delete errors[key as keyof T];
    }
    Object.assign(errors, next);
  }

  function reset(next?: T): void {
    const target = next ?? (JSON.parse(initialSnapshot.value) as T);
    Object.assign(values, structuredClone(target));
    if (next) initialSnapshot.value = JSON.stringify(next);
    setErrors({});
  }

  async function submit(
    handler: (values: T) => Promise<void>,
  ): Promise<boolean> {
    if (submittingFlag.value) return false;

    submittingFlag.value = true;
    setErrors({});

    // Ошибка НЕ перехватывается: её показывает вызывающий — только он знает,
    // какому полю её приписать и что сказать пользователю. Задача finally —
    // снять флаг отправки в обоих исходах, иначе неудача навсегда блокирует
    // кнопку.
    try {
      await handler(values);
      initialSnapshot.value = JSON.stringify(values);

      return true;
    } finally {
      submittingFlag.value = false;
    }
  }

  return {
    values,
    errors,
    submitting: computed(() => submittingFlag.value),
    isDirty: computed(() => JSON.stringify(values) !== initialSnapshot.value),
    setErrors,
    reset,
    submit,
  };
}
