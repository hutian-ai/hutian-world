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
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "node:*",
            "**/apps/api/**",
            "**/infra/**",
            "@harness-dock/*",
            "@hutian-ai/memory-gateway-client",
            "@hutian-ai/knowledge-gateway-client",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/contracts/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["node:*", "@nestjs/*", "typeorm", "**/apps/**"] },
      ],
    },
  },
  {
    files: ["apps/api/src/application/**/*.ts"],
    ignores: ["apps/api/src/application/application.module.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["**/transport/**", "**/web/**"] },
      ],
    },
  },
  {
    files: ["apps/api/src/modules/**/*.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["**/application/**", "**/transport/**"] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='query']",
          message:
            "Use an ORM repository; atomic SQL belongs in a scoped repository or explicit migration.",
        },
      ],
    },
  },
);
