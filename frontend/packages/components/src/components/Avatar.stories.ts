import type { Meta, StoryObj } from "@storybook/vue3";
import Avatar from "./Avatar.vue";

const meta: Meta<typeof Avatar> = {
  title: "Media/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  args: { name: "Аргус Филч" },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["small", "medium", "large", "huge"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Без src показываются инициалы: пустой круг не отличает людей в списке. */
export const Initials: Story = {};

export const Sizes: Story = {
  render: (args) => ({
    components: { Avatar },
    setup: () => ({ args }),
    template: `
      <div style="display:flex;gap:12px;align-items:center">
        <Avatar v-bind="args" size="small" />
        <Avatar v-bind="args" size="medium" />
        <Avatar v-bind="args" size="large" />
        <Avatar v-bind="args" size="huge" />
      </div>
    `,
  }),
};

export const Square: Story = {
  args: { square: true, size: "large" },
};

/** Битая ссылка не оставляет дыру в вёрстке — компонент падает на инициалы. */
export const BrokenImage: Story = {
  args: { src: "https://example.invalid/missing.png", size: "large" },
};
