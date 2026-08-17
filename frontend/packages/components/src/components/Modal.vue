<script lang="ts" setup>
// Разметка обёрнута в Teleport to="body": иначе overflow: hidden или transform
// родителя обрежет диалог, и его придётся «чинить» ростом z-index.
import { onBeforeUnmount, watch } from "vue";
import { lockScroll, unlockScroll } from "../utils/dom";

export type ModalSize = "small" | "medium" | "large";

export type ModalProps = {
  title?: string;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
};

const props = withDefaults(defineProps<ModalProps>(), {
  size: "medium",
  closeOnBackdrop: true,
});

const open = defineModel<boolean>("open", { default: false });

function close() {
  open.value = false;
}

function onBackdropClick() {
  if (props.closeOnBackdrop) close();
}

// Escape закрывает диалог: это ожидаемое поведение, а не «дополнительная
// фича». Слушатель висит на окне только пока диалог открыт.
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}

watch(
  open,
  (isOpen) => {
    if (typeof document === "undefined") return;

    if (isOpen) {
      lockScroll();
      window.addEventListener("keydown", onKeydown);
    } else {
      unlockScroll();
      window.removeEventListener("keydown", onKeydown);
    }
  },
  { immediate: true },
);

// Размонтирование при открытом диалоге не должно оставить страницу
// заблокированной.
onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  unlockScroll();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal" :size="props.size">
      <div class="modal__backdrop" @click="onBackdropClick" />
      <div
        class="modal__window"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title"
      >
        <header v-if="props.title || $slots.header" class="modal__header">
          <slot name="header">
            <h4 class="modal__title">{{ props.title }}</h4>
          </slot>
          <button
            class="modal__close"
            type="button"
            aria-label="Закрыть"
            @click="close"
          >
            ×
          </button>
        </header>

        <div class="modal__body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss">
.modal {
  --modal-width: 32rem;

  position: fixed;
  inset: 0;
  z-index: $z-index-modal;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-06);

  &__backdrop {
    position: absolute;
    inset: 0;
    background: var(--background-blackout-color);
    backdrop-filter: blur(2px);
  }

  &__window {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-06);

    width: 100%;
    max-width: var(--modal-width);
    max-height: 100%;
    overflow: auto;
    padding: var(--spacing-08);
    border-radius: $radius-large;
    background: var(--background-light-color);
    box-shadow: var(--shadow-04);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-04);
  }

  &__title {
    margin: 0;
    @include typography(h-4);
  }

  &__close {
    padding: 0 var(--spacing-02);
    border: none;
    background: transparent;
    color: var(--text-secondary-color);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-05);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-04);
  }

  &[size="small"] {
    --modal-width: 24rem;
  }
  &[size="large"] {
    --modal-width: 48rem;
  }

  // На узком экране диалог занимает всю ширину: центрированное окно в 32rem на
  // телефоне превращается в поля по 4px.
  @media (max-width: $breakpoint-tablet) {
    padding: var(--spacing-04);

    .modal__window {
      --modal-width: 100%;
      padding: var(--spacing-06);
    }
  }
}
</style>
