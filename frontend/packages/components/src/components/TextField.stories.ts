import type { Meta, StoryObj } from "@storybook/vue3";
import TextField from "./TextField.vue";

const meta: Meta<typeof TextField> = {
  title: "Controls/TextField",
  component: TextField,
  tags: ["autodocs"],
  args: { label: "Имя персонажа", placeholder: "Введите имя" },
  argTypes: {
    size: { control: "inline-radio", options: ["small", "medium", "large"] },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "От 2 до 60 символов" },
};

/** Ошибка получает role="alert" и красит рамку через один атрибут [invalid]. */
export const WithError: Story = {
  args: { error: "Имя уже занято" },
};

export const Required: Story = {
  args: { required: true, hint: "Обязательное поле" },
};

export const Disabled: Story = {
  args: { disabled: true, modelValue: "Недоступно" },
};

export const Sizes: Story = {
  render: (args) => ({
    components: { TextField },
    setup: () => ({ args }),
    template: `
      <div style="display:flex;flex-direction:column;gap:16px;max-width:320px">
        <TextField v-bind="args" size="small" label="small" />
        <TextField v-bind="args" size="medium" label="medium" />
        <TextField v-bind="args" size="large" label="large" />
      </div>
    `,
  }),
};
