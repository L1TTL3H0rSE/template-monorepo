import type { Meta, StoryObj } from "@storybook/vue3-vite";
import Badge from "./Badge.vue";

const meta: Meta<typeof Badge> = {
  title: "Data display/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { label: "Черновик" },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <Badge tone="neutral" label="neutral" />
        <Badge tone="primary" label="primary" />
        <Badge tone="success" label="success" />
        <Badge tone="warning" label="warning" />
        <Badge tone="error" label="error" />
        <Badge tone="info" label="info" />
      </div>
    `,
  }),
};

export const Subtle: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <Badge subtle tone="neutral" label="neutral" />
        <Badge subtle tone="primary" label="primary" />
        <Badge subtle tone="success" label="success" />
        <Badge subtle tone="warning" label="warning" />
        <Badge subtle tone="error" label="error" />
        <Badge subtle tone="info" label="info" />
      </div>
    `,
  }),
};
