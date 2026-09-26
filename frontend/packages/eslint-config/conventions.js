import importX from "eslint-plugin-import-x";

export default {
  plugins: { "import-x": importX },
  rules: {
    curly: ["error", "all"],
    "import-x/first": "error",
    "import-x/no-duplicates": "error",
    "import-x/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling", "index"],
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "@typescript-eslint/no-import-type-side-effects": "error",
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-ignore": true,
        "ts-expect-error": "allow-with-description",
        minimumDescriptionLength: 10,
      },
    ],
  },
};
