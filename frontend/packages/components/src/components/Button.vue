<script lang="ts" setup>
// Модификаторы — HTML-атрибуты (color/size/variant), а не классы
// button--primary. Значение приходит из props без конкатенации строк в :class,
// читается в DevTools как есть и стилизуется селектором [color="primary"].
// Элементы BEM при этом обычные: button__side.
//
// Пояснение стоит ЗДЕСЬ, а не комментарием в начале <template>: ведущий
// HTML-комментарий делает компонент multi-root, и атрибуты перестают попадать
// на корневой элемент (см. docs/PROJECT_MEMORY.md, MEM-012).
import type { Component, StyleValue } from "vue";
import { computed, ref } from "vue";
import { callMayBePromise } from "../utils/promises";

export type ButtonSize = "large" | "medium" | "small";
export type ButtonColor =
  "primary" | "secondary" | "error" | "warning" | "success" | "info";
export type ButtonVariant = "default" | "outlined" | "text" | "icon";
export type ButtonType = "submit" | "reset" | "button";

export type ButtonProps = {
  type?: ButtonType;
  disabled?: boolean;
  loading?: boolean;

  color?: ButtonColor;
  size?: ButtonSize;
  variant?: ButtonVariant;

  label?: string;
  title?: string;
  ariaLabel?: string;
  icon?: Component;
  sideIcon?: Component;

  onClick?: () => unknown;
  onSideClick?: () => unknown;
};

const props = withDefaults(defineProps<ButtonProps>(), {
  color: "primary",
  size: "medium",
  variant: "default",
  type: "button",
});

const localLoading = ref(false);
const isLoading = computed(() => props.loading || localLoading.value);

const buttonStyle = computed<StyleValue>(() => ({
  justifyContent: props.icon || props.sideIcon ? "space-between" : "center",
}));

// Иконка без подписи обязана нести доступное имя, иначе кнопка для скринридера
// безымянная. Берём явный ariaLabel, иначе title.
const accessibleLabel = computed(
  () =>
    props.ariaLabel ?? (!props.label && props.icon ? props.title : undefined),
);

async function handleClick() {
  if (props.disabled || isLoading.value) return;

  // Локальный loading на время промиса обработчика: без него двойной клик
  // отправляет запрос дважды, и каждый потребитель заводит свой ref.
  localLoading.value = true;
  try {
    await callMayBePromise(() => props.onClick?.());
  } catch (error) {
    console.error("[Button onClick]", error);
  } finally {
    localLoading.value = false;
  }
}

async function handleSideClick(event: MouseEvent) {
  if (props.disabled || isLoading.value || !props.onSideClick) return;
  event.stopPropagation();

  localLoading.value = true;
  try {
    await callMayBePromise(() => props.onSideClick?.());
  } catch (error) {
    console.error("[Button onSideClick]", error);
  } finally {
    localLoading.value = false;
  }
}
</script>

<template>
  <button
    class="button"
    :type="props.type"
    :disabled="props.disabled"
    :color="props.color"
    :size="props.size"
    :variant="props.variant"
    :is-loading="isLoading || undefined"
    :title="props.title"
    :aria-label="accessibleLabel"
    :aria-busy="isLoading || undefined"
    :style="buttonStyle"
    @click="handleClick"
  >
    <component :is="props.icon" v-if="props.icon" class="button__icon" />
    <span v-if="props.label" class="button__label">{{ props.label }}</span>
    <slot name="side">
      <span v-if="props.sideIcon" class="button__side" @click="handleSideClick">
        <component :is="props.sideIcon" />
      </span>
    </slot>
    <span v-if="isLoading" class="button__loader" aria-hidden="true" />
  </button>
</template>

<style lang="scss">
// Миксин цветового состояния: три состояния одного акцента задаются один раз.
// Без него шесть цветов × три состояния = 18 рукописных блоков, которые
// расходятся при первой же правке.
@mixin accent-color-state(
  $color-name,
  $default-var,
  $hover-var,
  $active-var,
  $text-var: null
) {
  &[color="#{$color-name}"] {
    --button-accent-color: var(--#{$default-var});

    @if $text-var {
      --button-text-color: var(--#{$text-var});
    }

    // (hover: hover) — на тач-устройстве hover «залипает» после тапа.
    @media (hover: hover) {
      &:hover:not(:disabled) {
        --button-accent-color: var(--#{$hover-var});
      }
    }
    &:active:not(:disabled) {
      --button-accent-color: var(--#{$active-var});
    }
  }
}

@mixin button-size($size-name, $padding, $icon-size, $text-token) {
  &[size="#{$size-name}"] {
    --button-padding: #{$padding};
    --button-icon-size: #{$icon-size};

    .button__label {
      @include typography($text-token);
    }
  }
}

.button {
  // Локальные CSS-переменные — API стилей блока. Варианты переопределяют
  // переменные, а не дублируют весь набор свойств: правило написано один раз.
  --button-accent-color: var(--primary-main-color);
  --button-text-color: var(--text-light-color);
  --button-background-color: var(--button-accent-color);
  --button-border: none;
  --button-padding: var(--spacing-04) var(--spacing-06);
  --button-icon-size: 1.125rem;
  --button-gap: var(--spacing-04);

  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--button-gap);

  padding: var(--button-padding);
  border: var(--button-border);
  border-radius: $radius-medium;
  color: var(--button-text-color);
  background-color: var(--button-background-color);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--transition-fast) var(--transition-easing),
    color var(--transition-fast) var(--transition-easing);

  svg {
    width: var(--button-icon-size);
    height: var(--button-icon-size);
    color: var(--button-text-color);
    flex-shrink: 0;
  }

  // --- элементы ---

  &__label {
    margin: 0;
    color: inherit;
  }

  &__side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-grow: 1;
  }

  &__loader {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1rem;
    height: 1rem;
    margin: -0.5rem 0 0 -0.5rem;
    border: 2px solid currentcolor;
    border-right-color: transparent;
    border-radius: $radius-round;
    animation: button-spin 700ms linear infinite;
  }

  // --- варианты (атрибуты, не классы) ---

  &[variant="outlined"] {
    --button-border: solid 1px var(--button-accent-color);
    --button-background-color: transparent;
    --button-text-color: var(--button-accent-color);
  }
  &[variant="text"] {
    --button-background-color: transparent;
    --button-text-color: var(--button-accent-color);
  }
  &[variant="icon"] {
    --button-gap: 0;

    &[size="small"] {
      --button-padding: var(--spacing-03);
    }
    &[size="medium"],
    &[size="large"] {
      --button-padding: var(--spacing-04);
    }
  }

  @include button-size(
    "large",
    var(--spacing-04) var(--spacing-08),
    1.25rem,
    forms-button-l
  );
  @include button-size(
    "medium",
    var(--spacing-04) var(--spacing-06),
    1.125rem,
    forms-button-m
  );
  @include button-size(
    "small",
    var(--spacing-03) var(--spacing-05),
    1rem,
    forms-button-s
  );

  @include accent-color-state(
    "primary",
    "primary-main-color",
    "primary-hover-color",
    "primary-active-color"
  );
  @include accent-color-state(
    "secondary",
    "secondary-light-color",
    "secondary-hover-color",
    "secondary-active-color",
    "text-primary-color"
  );
  @include accent-color-state(
    "error",
    "error-default-color",
    "error-hover-color",
    "error-active-color"
  );
  @include accent-color-state(
    "warning",
    "warning-default-color",
    "warning-hover-color",
    "warning-active-color"
  );
  @include accent-color-state(
    "success",
    "success-default-color",
    "success-hover-color",
    "success-active-color"
  );
  @include accent-color-state(
    "info",
    "info-default-color",
    "info-hover-color",
    "info-active-color"
  );

  // --- состояния ---

  &:focus-visible {
    @include focus-ring;
  }

  &:disabled {
    --button-text-color: var(--text-disabled-color);
    --button-accent-color: var(--disabled-background-color);
    --button-border: none;
    cursor: default;
  }

  // Содержимое прячется, а не размонтируется: ширина кнопки не прыгает при
  // включении загрузки.
  &[is-loading="true"] {
    .button__icon,
    .button__label,
    .button__side {
      opacity: 0;
    }
  }
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
