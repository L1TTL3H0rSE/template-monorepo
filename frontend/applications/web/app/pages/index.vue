<script lang="ts" setup>
import { Button, Card } from "@starter/components";

useHead({ title: "Starter — главная" });
</script>

<template>
  <section class="home">
    <h1 class="home__title">Шаблон проекта</h1>
    <p class="home__lead">
      Go-бэкенд, pnpm-workspace, дизайн-система со Storybook и Nuxt-приложение.
      Паттерны разобраны в каталоге <code>docs/</code>.
    </p>

    <div class="home__cards">
      <Card title="Дизайн-система">
        <p>
          Токены, BEM с модификаторами-атрибутами и витрина Storybook в
          <code>frontend/packages/components</code>.
        </p>
        <template #footer>
          <Button variant="text" label="pnpm storybook" size="small" />
        </template>
      </Card>

      <Card title="Слои данных">
        <p>
          Контракт домена, HTTP- и mock-адаптеры одного порта, переключение
          провайдера через переменную окружения.
        </p>
        <template #footer>
          <NuxtLink to="/characters">Открыть пример</NuxtLink>
        </template>
      </Card>

      <Card title="Бэкенд">
        <p>
          Эталонный сервис <code>backend/gotemplate</code>: тонкий слой
          сценариев, sqlc, доменные категории ошибок, fail-closed роутер.
        </p>
      </Card>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-06);

  &__title {
    margin: 0;
  }

  &__lead {
    max-width: 60ch;
    color: var(--text-secondary-color);
    @include typography(p-l);
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--spacing-06);
    margin-top: var(--spacing-06);
  }
}
</style>
