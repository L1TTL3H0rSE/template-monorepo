import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import Button from "./Button.vue";
import Modal from "./Modal.vue";

const meta: Meta<typeof Modal> = {
  title: "Overlay/Modal",
  component: Modal,
  tags: ["autodocs"],
  args: { title: "Удалить персонажа?" },
  argTypes: {
    size: { control: "inline-radio", options: ["small", "medium", "large"] },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * История с кнопкой, а не с `open: true`: так проверяются реальные переходы —
 * блокировка прокрутки, закрытие по Escape и по клику вне окна.
 */
export const Default: Story = {
  render: (args) => ({
    components: { Modal, Button },
    setup() {
      const open = ref(false);

      return { args, open };
    },
    template: `
      <div>
        <Button label="Открыть" @click="open = true" />
        <Modal v-bind="args" v-model:open="open">
          <p>Действие необратимо.</p>
          <template #footer>
            <Button variant="text" color="secondary" label="Отмена" @click="open = false" />
            <Button color="error" label="Удалить" @click="open = false" />
          </template>
        </Modal>
      </div>
    `,
  }),
};

export const Large: Story = {
  ...Default,
  args: { size: "large", title: "Редактирование анкеты" },
};

/** closeOnBackdrop=false — для форм, где случайный клик мимо стоит дорого. */
export const PersistentBackdrop: Story = {
  ...Default,
  args: { closeOnBackdrop: false },
};
