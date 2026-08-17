import type { Meta, StoryObj } from "@storybook/vue3";
import Button from "./Button.vue";

/**
 * Истории — это витрина состояний, а не тест.
 *
 * Правило: каждая ветка стилей, которую нельзя увидеть в дефолтном виде
 * (вариант, размер, цвет, disabled, loading), имеет свою историю. Если ветка
 * есть в SCSS, но её нет здесь, — она не проверяется глазами никогда.
 */
const meta: Meta<typeof Button> = {
  title: "Controls/Button",
  component: Button,
  tags: ["autodocs"],
  args: { label: "Действие" },
  argTypes: {
    color: {
      control: "select",
      options: ["primary", "secondary", "error", "warning", "success", "info"],
    },
    size: { control: "inline-radio", options: ["small", "medium", "large"] },
    variant: {
      control: "inline-radio",
      options: ["default", "outlined", "text", "icon"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Sizes: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: `
      <div style="display:flex;gap:12px;align-items:center">
        <Button v-bind="args" size="small" label="small" />
        <Button v-bind="args" size="medium" label="medium" />
        <Button v-bind="args" size="large" label="large" />
      </div>
    `,
  }),
};

export const Variants: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: `
      <div style="display:flex;gap:12px;align-items:center">
        <Button v-bind="args" variant="default" label="default" />
        <Button v-bind="args" variant="outlined" label="outlined" />
        <Button v-bind="args" variant="text" label="text" />
      </div>
    `,
  }),
};

export const Colors: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: `
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <Button v-bind="args" color="primary" label="primary" />
        <Button v-bind="args" color="secondary" label="secondary" />
        <Button v-bind="args" color="success" label="success" />
        <Button v-bind="args" color="warning" label="warning" />
        <Button v-bind="args" color="error" label="error" />
        <Button v-bind="args" color="info" label="info" />
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { loading: true },
};

/**
 * onClick, возвращающий промис, включает индикатор загрузки автоматически —
 * потребителю не нужен собственный ref.
 */
export const AsyncClick: Story = {
  args: {
    label: "Сохранить",
    onClick: () => new Promise((resolve) => setTimeout(resolve, 1500)),
  },
};
