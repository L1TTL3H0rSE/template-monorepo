<script lang="ts" setup>
export type BadgeTone =
  "neutral" | "primary" | "success" | "warning" | "error" | "info";

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  subtle?: boolean;
};

const props = withDefaults(defineProps<BadgeProps>(), { tone: "neutral" });
</script>

<template>
  <span class="badge" :tone="props.tone" :subtle="props.subtle || undefined">{{
    props.label
  }}</span>
</template>

<style lang="scss">
@use "sass:map";

// Карта тонов: цвет статуса задаётся один раз списком, а не шестью почти
// одинаковыми блоками правил. Новый тон — одна строка здесь плюс значение в
// union-типе BadgeTone; забыть одно из двух не даст TypeScript.
$badge-tones: (
  "neutral": (
    "color": --secondary-main-color,
    "background": --secondary-light-color,
  ),
  "primary": (
    "color": --primary-main-color,
    "background": --primary-light-color,
  ),
  "success": (
    "color": --success-default-color,
    "background": --background-primary-color,
  ),
  "warning": (
    "color": --warning-default-color,
    "background": --background-primary-color,
  ),
  "error": (
    "color": --error-default-color,
    "background": --background-primary-color,
  ),
  "info": (
    "color": --info-default-color,
    "background": --background-secondary-color,
  ),
);

.badge {
  --badge-color: var(--secondary-main-color);
  --badge-background: var(--secondary-light-color);
  --badge-text: var(--text-light-color);

  display: inline-flex;
  align-items: center;
  padding: var(--spacing-01) var(--spacing-04);
  border-radius: $radius-small;
  color: var(--badge-text);
  background: var(--badge-color);
  white-space: nowrap;
  @include typography(h-st-2);

  @each $tone, $vars in $badge-tones {
    &[tone="#{$tone}"] {
      --badge-color: var(#{map.get($vars, "color")});
      --badge-background: var(#{map.get($vars, "background")});
    }
  }

  // subtle — приглушённый вариант: фон вместо заливки, цвет текста акцентный.
  &[subtle] {
    --badge-text: var(--badge-color);
    background: var(--badge-background);
  }
}
</style>
