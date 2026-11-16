import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      ".local/**",
      ".agents/**",
      ".husky/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ["apps/web/**/*.{js,mjs,ts,tsx}"],

    languageOptions: { globals: globals.browser },
  },
);
