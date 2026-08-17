<script lang="ts" setup>
import { computed, useId } from "vue";

export type TextFieldSize = "large" | "medium" | "small";

export type TextFieldProps = {
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  size?: TextFieldSize;
  type?: "text" | "email" | "password" | "search" | "url";
  disabled?: boolean;
  required?: boolean;
  maxlength?: number;
};

const props = withDefaults(defineProps<TextFieldProps>(), {
  size: "medium",
  type: "text",
});

// defineModel вместо пары modelValue + emit("update:modelValue"): та же
// двусторонняя связь без ручного проброса.
const model = defineModel<string>({ default: "" });

const inputId = useId();
const describedById = computed(() => `${inputId}-description`);
const hasError = computed(() => Boolean(props.error));
</script>

<template>
  <div
    class="text-field"
    :size="props.size"
    :invalid="hasError || undefined"
    :disabled="props.disabled || undefined"
  >
    <label v-if="props.label" class="text-field__label" :for="inputId">
      {{ props.label }}
      <span
        v-if="props.required"
        class="text-field__required"
        aria-hidden="true"
        >*</span
      >
    </label>

    <input
      :id="inputId"
      v-model="model"
      class="text-field__input"
      :type="props.type"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :required="props.required"
      :maxlength="props.maxlength"
      :aria-invalid="hasError || undefined"
      :aria-describedby="props.hint || props.error ? describedById : undefined"
    />

    <!--
      Подсказка и ошибка живут в одном узле с общим id: скринридер объявляет
      актуальный текст, а разметка не меняет структуру при появлении ошибки.
      Ошибка получает role="alert", поэтому объявляется сразу.
    -->
    <p
      v-if="props.hint || props.error"
      :id="describedById"
      class="text-field__description"
      :role="hasError ? 'alert' : undefined"
    >
      {{ props.error || props.hint }}
    </p>
  </div>
</template>

<style lang="scss">
.text-field {
  --field-border-color: var(--secondary-border-color);
  --field-accent-color: var(--primary-main-color);
  --field-padding: var(--spacing-04) var(--spacing-05);
  --field-description-color: var(--text-secondary-color);

  display: flex;
  flex-direction: column;
  gap: var(--spacing-02);

  &__label {
    color: var(--text-secondary-color);
    @include typography(h-st-1);
  }

  &__required {
    color: var(--error-default-color);
  }

  &__input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--field-padding);
    border: 1px solid var(--field-border-color);
    border-radius: $radius-medium;
    color: var(--text-primary-color);
    background: var(--background-light-color);
    transition: border-color var(--transition-fast) var(--transition-easing);
    @include typography(forms-input-m);

    &::placeholder {
      color: var(--text-placeholder-color);
    }

    &:focus {
      border-color: var(--field-accent-color);
      outline: none;
    }
    &:focus-visible {
      @include focus-ring;
    }
    &:disabled {
      color: var(--text-disabled-color);
      background: var(--disabled-background-color);
      cursor: default;
    }
  }

  &__description {
    margin: 0;
    color: var(--field-description-color);
    @include typography(p-s);
  }

  &[size="large"] {
    --field-padding: var(--spacing-05) var(--spacing-06);

    .text-field__input {
      @include typography(forms-input-l);
    }
  }
  &[size="small"] {
    --field-padding: var(--spacing-03) var(--spacing-04);

    .text-field__input {
      @include typography(forms-input-s);
    }
  }

  &[invalid] {
    --field-border-color: var(--error-default-color);
    --field-accent-color: var(--error-default-color);
    --field-description-color: var(--error-default-color);
  }
}
</style>
