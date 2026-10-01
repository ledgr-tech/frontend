import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/font/google",
              message:
                "Use next/font/local com o arquivo em app/fonts (ver app/layout.tsx): o next/font/google baixa do Google a cada build, e às vezes o build cai (vercel/next.js#99114).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local reference export from Claude Design; gitignored, not project code.
    "v2- informações simples/**",
    // Isolated worktrees for in-progress feature branches.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
