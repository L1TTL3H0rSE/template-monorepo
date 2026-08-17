import { computed, type ModelRef, type WritableComputedRef } from "vue";

/**
 * Двусторонняя обёртка над `defineModel` с преобразованием значения.
 *
 * Типичный случай: поле формы хранит строку, а модель — число или дату.
 * Наивное решение — watch в обе стороны — даёт цикл обновлений и потерю
 * ввода; computed с get/set его не создаёт.
 *
 * @example
 * const model = defineModel<number>();
 * const text = useMappedModel(model, {
 *   toView: (value) => String(value ?? ""),
 *   toModel: (value) => Number(value) || 0,
 * });
 */
export function useMappedModel<TModel, TView>(
  model: ModelRef<TModel> | WritableComputedRef<TModel>,
  mapper: {
    toView: (value: TModel) => TView;
    toModel: (value: TView) => TModel;
  },
): WritableComputedRef<TView> {
  return computed({
    get: () => mapper.toView(model.value),
    set: (value) => {
      model.value = mapper.toModel(value);
    },
  });
}
