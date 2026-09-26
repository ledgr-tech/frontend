import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "server-only": resolve(__dirname, "./tests/vazio.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/.worktrees/**"],
    // o next-auth importa "next/server" sem extensão, o que o Node puro não resolve;
    // passando pelo Vite, resolve (é só para os testes que importam o CredentialsSignin)
    server: { deps: { inline: ["next-auth"] } },
    // 5s (o default) já estourava com os arquivos rodando em paralelo: o teste
    // que abre "Esqueci a senha" espera um import dinâmico (o card e o motion),
    // e sob disputa de CPU isso passa de 5s. Serializado, a suíte inteira passa
    // — ou seja, é orçamento de tempo, não travamento. Um travamento de verdade
    // continua falhando, só que 15s depois.
    testTimeout: 15_000,
  },
});