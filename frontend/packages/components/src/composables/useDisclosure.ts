import { readonly, ref, type Ref } from "vue";

export type Disclosure = {
  isOpen: Readonly<Ref<boolean>>;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

/**
 * Состояние «открыто/закрыто» для меню, диалога, аккордеона.
 *
 * `isOpen` возвращается через readonly: менять его можно только вызовами
 * open/close/toggle. Без этого потребитель начинает писать
 * `disclosure.isOpen.value = true` в обход, и логика закрытия (снятие фокуса,
 * разблокировка прокрутки) обходится молча.
 */
export function useDisclosure(initial = false): Disclosure {
  const isOpen = ref(initial);

  return {
    isOpen: readonly(isOpen),
    open: () => {
      isOpen.value = true;
    },
    close: () => {
      isOpen.value = false;
    },
    toggle: () => {
      isOpen.value = !isOpen.value;
    },
  };
}
