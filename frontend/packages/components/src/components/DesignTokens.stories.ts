import type { Meta, StoryObj } from "@storybook/vue3-vite";

/**
 * Витрина токенов.
 *
 * Она существует не для красоты: без наглядного списка разработчик подбирает
 * цвет и отступ на глаз, и в проекте появляется седьмой оттенок серого.
 */
const meta: Meta = {
  title: "Foundations/Design tokens",
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj;

const COLOR_GROUPS = {
  Текст: [
    "--text-primary-color",
    "--text-secondary-color",
    "--text-placeholder-color",
    "--text-disabled-color",
  ],
  Primary: [
    "--primary-main-color",
    "--primary-hover-color",
    "--primary-active-color",
    "--primary-light-color",
  ],
  Статусы: [
    "--success-default-color",
    "--warning-default-color",
    "--error-default-color",
    "--info-default-color",
  ],
  Фон: [
    "--background-primary-color",
    "--background-secondary-color",
    "--background-light-color",
    "--disabled-background-color",
  ],
};

export const Colors: Story = {
  render: () => ({
    setup: () => ({ groups: COLOR_GROUPS }),
    template: `
      <div style="display:flex;flex-direction:column;gap:24px">
        <section v-for="(tokens, group) in groups" :key="group">
          <h5 style="margin:0 0 12px">{{ group }}</h5>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div v-for="token in tokens" :key="token" style="width:160px">
              <div :style="{ background: 'var(' + token + ')', height: '48px', borderRadius: '8px', border: '1px solid var(--divider-default-color)' }" />
              <code style="font-size:11px">{{ token }}</code>
            </div>
          </div>
        </section>
      </div>
    `,
  }),
};

export const Spacings: Story = {
  render: () => ({
    setup: () => ({
      tokens: Array.from(
        { length: 15 },
        (_, index) => `--spacing-${String(index + 1).padStart(2, "0")}`,
      ),
    }),
    template: `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div v-for="token in tokens" :key="token" style="display:flex;align-items:center;gap:12px">
          <code style="width:120px;font-size:11px">{{ token }}</code>
          <div :style="{ width: 'var(' + token + ')', height: '16px', background: 'var(--primary-main-color)' }" />
        </div>
      </div>
    `,
  }),
};

export const Typography: Story = {
  render: () => ({
    template: `
      <div>
        <h1>h-1 Заголовок</h1>
        <h2>h-2 Заголовок</h2>
        <h3>h-3 Заголовок</h3>
        <h4>h-4 Заголовок</h4>
        <h5>h-5 Заголовок</h5>
        <h6>h-6 Заголовок</h6>
        <p>p-primary — основной текст интерфейса.</p>
        <small>p-s — вспомогательный текст.</small>
      </div>
    `,
  }),
};
