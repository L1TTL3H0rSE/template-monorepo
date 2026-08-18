import type { Meta, StoryObj } from "@storybook/vue3-vite";
import Card from "./Card.vue";

const meta: Meta<typeof Card> = {
  title: "Layout/Card",
  component: Card,
  tags: ["autodocs"],
  args: { title: "Карточка персонажа" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["elevated", "outlined", "flat"],
    },
    padding: {
      control: "inline-radio",
      options: ["none", "compact", "regular"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Elevated: Story = {
  render: (args) => ({
    components: { Card },
    setup: () => ({ args }),
    template: `
      <Card v-bind="args" style="max-width:420px">
        <p>Содержимое приходит через слот: карточка задаёт рамку и отступы, а не решает, что внутри.</p>
      </Card>
    `,
  }),
};

export const Outlined: Story = {
  ...Elevated,
  args: { variant: "outlined" },
};

export const WithFooter: Story = {
  render: (args) => ({
    components: { Card },
    setup: () => ({ args }),
    template: `
      <Card v-bind="args" style="max-width:420px">
        <p>Слот footer появляется только когда он передан.</p>
        <template #footer>
          <span>Обновлено сегодня</span>
        </template>
      </Card>
    `,
  }),
};

export const Interactive: Story = {
  ...Elevated,
  args: { interactive: true },
};
