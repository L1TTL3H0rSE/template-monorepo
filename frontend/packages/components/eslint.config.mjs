import boundaries from "@starter/eslint-config/boundaries";
import config from "@starter/eslint-config/storybook";
import typed from "@starter/eslint-config/typed";

export default [
  ...config,
  ...typed(import.meta.url),
  boundaries(import.meta.url),
];
