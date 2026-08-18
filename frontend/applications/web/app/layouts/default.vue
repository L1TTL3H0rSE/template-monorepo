<script lang="ts" setup>
const links = [
  { to: "/", label: "Главная" },
  { to: "/characters", label: "Персонажи" },
];
</script>

<template>
  <div class="layout">
    <header class="layout__header">
      <div class="container layout__header-inner">
        <NuxtLink class="layout__brand" to="/">Starter</NuxtLink>
        <nav class="layout__nav">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            class="layout__link"
            :to="link.to"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="layout__main container">
      <slot />
    </main>

    <footer class="layout__footer">
      <div class="container">
        <small>Шаблон проекта. Замените содержимое на своё.</small>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
// scoped в приложении, не scoped в пакете компонентов.
// Причина: стиль страницы не должен протекать в дизайн-систему, а стиль
// компонента библиотеки обязан быть переопределяемым потребителем.
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__header {
    border-bottom: 1px solid var(--divider-default-color);
    background: var(--background-light-color);
  }

  &__header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-06);
    padding-top: var(--spacing-05);
    padding-bottom: var(--spacing-05);
  }

  &__brand {
    color: var(--text-primary-color);
    @include typography(h-5);
  }

  &__nav {
    display: flex;
    gap: var(--spacing-06);
  }

  &__link {
    color: var(--text-secondary-color);
    @include typography(h-st-1);

    &.router-link-active {
      color: var(--primary-main-color);
    }
  }

  &__main {
    flex-grow: 1;
    padding-top: var(--spacing-09);
    padding-bottom: var(--spacing-11);
  }

  &__footer {
    padding: var(--spacing-06) 0;
    border-top: 1px solid var(--divider-default-color);
    color: var(--text-secondary-color);
  }

  @media (max-width: $breakpoint-tablet) {
    &__header-inner {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-04);
    }
  }
}
</style>
