<script lang="ts" setup>
import {
  Avatar,
  Badge,
  Button,
  Card,
  Modal,
  TextField,
} from "@roleplay/components";
import type { CharacterStatus } from "~/contracts/character";
import { useCharactersStore } from "~/stores/characters";
import { useCharacterForm } from "~/composables/useCharacterForm";

useHead({ title: "Персонажи" });

const store = useCharactersStore();
const { form, submit } = useCharacterForm();

const createOpen = ref(false);

const STATUS_TONE: Record<CharacterStatus, "success" | "neutral" | "warning"> =
  {
    published: "success",
    draft: "warning",
    archived: "neutral",
  };
const STATUS_LABEL: Record<CharacterStatus, string> = {
  published: "Опубликован",
  draft: "Черновик",
  archived: "В архиве",
};

// Первая загрузка через onMounted, а не в setup: провайдер mock работает и на
// сервере, но реальный HTTP-запрос из SSR ушёл бы без токена пользователя.
onMounted(() => void store.load());

async function onCreate() {
  const created = await submit(async (draft) => {
    await store.create(draft);
  });

  if (created) {
    createOpen.value = false;
    form.reset({ name: "" });
  }
}
</script>

<template>
  <section class="characters">
    <header class="characters__header">
      <h1 class="characters__title">Персонажи</h1>
      <Button label="Создать" @click="createOpen = true" />
    </header>

    <TextField
      v-model="store.search.raw"
      class="characters__search"
      type="search"
      placeholder="Поиск по имени"
      hint="Поиск начинается с двух символов"
    />

    <!--
      Три состояния списка описаны явно: загрузка, ошибка, пусто.
      Шаблон, в котором есть только v-for, показывает пустой экран и при
      загрузке, и при сбое сети — пользователь не может их различить.
    -->
    <p v-if="store.pending" class="characters__state">Загружаем…</p>
    <p v-else-if="store.error" class="characters__state" role="alert">
      {{ store.error }}
    </p>
    <p v-else-if="!store.items.length" class="characters__state">
      Ничего не найдено.
    </p>

    <div v-else class="characters__grid">
      <Card
        v-for="character in store.items"
        :key="character.id"
        variant="outlined"
        padding="compact"
      >
        <div class="characters__item">
          <Avatar :name="character.name" size="large" />
          <div class="characters__meta">
            <h5 class="characters__name">{{ character.name }}</h5>
            <Badge
              subtle
              :tone="STATUS_TONE[character.status]"
              :label="STATUS_LABEL[character.status]"
            />
          </div>
        </div>
        <template #footer>
          <Button
            variant="text"
            color="error"
            size="small"
            label="Удалить"
            :on-click="() => store.remove(character.id)"
          />
        </template>
      </Card>
    </div>

    <!--
      Без `.value`: Pinia оборачивает результат setup-стора в reactive(),
      который разворачивает ref-ы и во вложенных объектах. Обращение
      `pagination.totalPages.value` вернуло бы undefined.
    -->
    <nav v-if="store.pagination.totalPages > 1" class="characters__pagination">
      <Button
        variant="outlined"
        size="small"
        label="Назад"
        :disabled="!store.pagination.canPrevious"
        @click="store.pagination.previous()"
      />
      <span
        >{{ store.pagination.page }} / {{ store.pagination.totalPages }}</span
      >
      <Button
        variant="outlined"
        size="small"
        label="Вперёд"
        :disabled="!store.pagination.canNext"
        @click="store.pagination.next()"
      />
    </nav>

    <Modal v-model:open="createOpen" title="Новый персонаж">
      <TextField
        v-model="form.values.name"
        label="Имя"
        required
        :error="form.errors.name"
      />
      <template #footer>
        <Button
          variant="text"
          color="secondary"
          label="Отмена"
          @click="createOpen = false"
        />
        <Button
          label="Создать"
          :loading="form.submitting.value"
          :on-click="onCreate"
        />
      </template>
    </Modal>
  </section>
</template>

<style lang="scss" scoped>
.characters {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-06);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-04);
  }

  &__title {
    margin: 0;
  }

  &__search {
    max-width: 360px;
  }

  &__state {
    color: var(--text-secondary-color);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--spacing-05);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: var(--spacing-05);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-02);
    min-width: 0;
  }

  &__name {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-05);
  }
}
</style>
