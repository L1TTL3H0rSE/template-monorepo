import { defineStore } from "pinia";
import { computed, markRaw, shallowReactive, type Component } from "vue";
import { lockScroll, unlockScroll } from "../utils/dom";

type ModalEntry = {
  key: string;
  component: Component;
  props: Record<string, unknown>;
  onClose?: (payload?: unknown) => void;
};

/**
 * Реестр открытых модальных окон.
 *
 * Зачем стор, а не `v-if` в компоненте: диалог часто открывают из места, где
 * его негде отрисовать (обработчик в сторе, перехватчик ошибок, пункт меню).
 * Реестр разделяет «кто открыл» и «где отрисовано».
 *
 * Стек, а не одно значение: подтверждение поверх формы — обычный сценарий, и
 * закрытие верхнего диалога обязано вернуть управление нижнему.
 */
export const useModalsStore = defineStore("components/modals", () => {
  // shallowReactive: реактивна сама карта (добавление/удаление), а props
  // компонентов остаются непрозрачными значениями. Глубокая реактивность здесь
  // только замедляет и ломает markRaw-компоненты.
  const entries = shallowReactive(new Map<string, ModalEntry>());

  const stack = computed(() => [...entries.values()]);
  const activeKey = computed(() => stack.value.at(-1)?.key);

  function open(options: {
    component: Component;
    props?: Record<string, unknown>;
    key?: string;
    onClose?: (payload?: unknown) => void;
  }): string {
    const key = options.key ?? crypto.randomUUID();
    const shouldLock = entries.size === 0;

    entries.set(key, {
      key,
      // markRaw: компонент — не реактивные данные. Без него Vue оборачивает
      // определение компонента в прокси и выдаёт предупреждение.
      component: markRaw(options.component),
      props: options.props ?? {},
      onClose: options.onClose,
    });

    if (shouldLock) lockScroll();

    return key;
  }

  function close(key: string, payload?: unknown): void {
    const entry = entries.get(key);
    if (!entry) return;

    entry.onClose?.(payload);
    entries.delete(key);

    if (entries.size === 0) unlockScroll();
  }

  function closeAll(): void {
    for (const key of [...entries.keys()]) close(key);
  }

  return { entries, stack, activeKey, open, close, closeAll };
});
