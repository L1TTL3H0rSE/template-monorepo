<script lang="ts" setup>
import { Button } from "@starter/components";
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

// Наружу показывается статус и общая формулировка. Текст внутренней ошибки не
// выводится: он адресован разработчику и часто содержит детали инфраструктуры.
const title = computed(() =>
  props.error.statusCode === 404
    ? "Страница не найдена"
    : "Что-то пошло не так",
);
</script>

<template>
  <div class="error-page">
    <h1 class="error-page__code">{{ props.error.statusCode }}</h1>
    <p class="error-page__title">{{ title }}</p>
    <Button
      label="На главную"
      :on-click="() => clearError({ redirect: '/' })"
    />
  </div>
</template>

<style lang="scss" scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-06);
  min-height: 100vh;
  text-align: center;

  &__code {
    margin: 0;
    color: var(--primary-main-color);
  }

  &__title {
    margin: 0;
    color: var(--text-secondary-color);
  }
}
</style>
