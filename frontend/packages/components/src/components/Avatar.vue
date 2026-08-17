<script lang="ts" setup>
import { computed, ref, watch } from "vue";

export type AvatarSize = "small" | "medium" | "large" | "huge";

export type AvatarProps = {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  square?: boolean;
};

const props = withDefaults(defineProps<AvatarProps>(), { size: "medium" });

const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const showImage = computed(() => Boolean(props.src) && !failed.value);

// Инициалы как запасной вариант: пустой серый круг не отличает пользователей
// друг от друга в списке.
const initials = computed(() =>
  (props.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join(""),
);
</script>

<template>
  <span class="avatar" :size="props.size" :square="props.square || undefined">
    <img
      v-if="showImage"
      class="avatar__image"
      :src="props.src ?? undefined"
      :alt="props.name ?? ''"
      loading="lazy"
      @error="failed = true"
    />
    <!--
      Заглушка помечена aria-hidden: имя пользователя уже присутствует рядом в
      разметке, и скринридер не должен читать «АБ» как отдельный текст.
    -->
    <span v-else class="avatar__fallback" aria-hidden="true">{{
      initials
    }}</span>
  </span>
</template>

<style lang="scss">
.avatar {
  --avatar-size: 2.5rem;
  --avatar-radius: #{$radius-round};

  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  width: var(--avatar-size);
  height: var(--avatar-size);
  overflow: hidden;
  border-radius: var(--avatar-radius);
  background: var(--secondary-light-color);
  color: var(--text-secondary-color);
  user-select: none;

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__fallback {
    @include typography(h-st-1);
  }

  &[size="small"] {
    --avatar-size: 1.75rem;
  }
  &[size="large"] {
    --avatar-size: 4rem;
  }
  &[size="huge"] {
    --avatar-size: 7.5rem;
  }

  &[square] {
    --avatar-radius: #{$radius-medium};
  }
}
</style>
