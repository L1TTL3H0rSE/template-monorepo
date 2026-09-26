import boundaries from "@starter/eslint-config/boundaries";
import typed from "@starter/eslint-config/typed";
import config from "@starter/eslint-config/vue";

export default [
  ...config,
  ...typed(import.meta.url),
  boundaries(import.meta.url),
];
