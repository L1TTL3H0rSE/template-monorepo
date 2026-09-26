import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default function typed(configUrl) {
  return [
    {
      files: ["**/*.{ts,tsx,vue}"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          project: "./tsconfig.lint.json",
          tsconfigRootDir: dirname(fileURLToPath(configUrl)),
          extraFileExtensions: [".vue"],
        },
      },
      rules: {
        "@typescript-eslint/no-floating-promises": [
          "error",
          { ignoreVoid: false },
        ],
      },
    },
    {
      files: ["**/*.vue"],
      languageOptions: {
        parser: vueParser,
        parserOptions: { parser: tseslint.parser },
      },
    },
  ];
}
