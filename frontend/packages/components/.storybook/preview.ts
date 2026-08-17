import { setup, type Preview } from "@storybook/vue3";
import { createPinia } from "pinia";
import * as components from "../src/components";
import { breakpoints } from "../src/utils/_breakpoints";
import "../src/assets/scss/global.scss";

setup((app) => {
  // Pinia нужна компонентам, которые читают стор (например, реестр модалок).
  app.use(createPinia());

  // Все компоненты регистрируются глобально: история пишет <Button /> так же,
  // как приложение с авто-импортом, и разметка в истории совпадает с реальной.
  for (const [name, component] of Object.entries(components)) {
    app.component(name, component as never);
  }
});

// Viewports берутся из того же breakpoints.json, что и SCSS-переменные:
// проверка адаптива идёт ровно по границам, которые использует CSS.
const customViewports = Object.fromEntries(
  Object.entries(breakpoints).map(([name, value]) => {
    const width = value + 1;

    return [
      name,
      {
        name: `${name} (${width}px)`,
        styles: { width: `${width}px`, height: "100%" },
        type: width < 600 ? "mobile" : width < 1024 ? "tablet" : "desktop",
      },
    ];
  }),
);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    viewport: { viewports: customViewports },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#f7f6fb" },
        { name: "surface", value: "#ffffff" },
      ],
    },
  },
};

export default preview;
