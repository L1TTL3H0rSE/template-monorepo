<script lang="ts" setup>
// Слоты вместо props для содержимого: карточка задаёт рамку и отступы, а не
// решает, что внутри. Попытка описать содержимое пропсами (titleIcon, subtitle,
// footerText, footerButtonLabel…) кончается компонентом с 20 props, который всё
// равно не покрывает следующий макет.
export type CardVariant = "elevated" | "outlined" | "flat";
export type CardPadding = "none" | "compact" | "regular";

export type CardProps = {
  variant?: CardVariant;
  padding?: CardPadding;
  title?: string;
  interactive?: boolean;
};

const props = withDefaults(defineProps<CardProps>(), {
  variant: "elevated",
  padding: "regular",
});
</script>

<template>
  <section
    class="card"
    :variant="props.variant"
    :padding="props.padding"
    :interactive="props.interactive || undefined"
  >
    <header v-if="props.title || $slots.header" class="card__header">
      <slot name="header">
        <h5 class="card__title">{{ props.title }}</h5>
      </slot>
    </header>

    <div class="card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style lang="scss">
.card {
  --card-padding: var(--spacing-08);
  --card-background: var(--background-light-color);
  --card-border: none;
  --card-shadow: var(--shadow-02);

  display: flex;
  flex-direction: column;
  gap: var(--spacing-06);

  padding: var(--card-padding);
  border: var(--card-border);
  border-radius: $radius-large;
  background: var(--card-background);
  box-shadow: var(--card-shadow);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-04);
  }

  &__title {
    margin: 0;
    @include typography(h-5);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-05);
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: var(--spacing-04);
    padding-top: var(--spacing-04);
    border-top: 1px solid var(--divider-default-color);
  }

  &[variant="outlined"] {
    --card-border: 1px solid var(--secondary-border-color);
    --card-shadow: none;
  }
  &[variant="flat"] {
    --card-background: transparent;
    --card-shadow: none;
  }

  &[padding="none"] {
    --card-padding: 0;
  }
  &[padding="compact"] {
    --card-padding: var(--spacing-05);
  }

  &[interactive] {
    cursor: pointer;
    transition:
      box-shadow var(--transition-base) var(--transition-easing),
      transform var(--transition-base) var(--transition-easing);

    @media (hover: hover) {
      &:hover {
        box-shadow: var(--shadow-03);
        transform: translateY(-2px);
      }
    }
  }
}
</style>
