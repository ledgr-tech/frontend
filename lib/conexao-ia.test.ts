import { describe, it, expect } from "vitest";
import { DOCUMENTACAO_DA_IA, ENDERECO_SEM_BASE, NOME_DA_IA, enderecoDoConector } from "./conexao-ia";

describe("conexão com IA", () => {
  it("monta o endereço do conector a partir da API, sem barra dobrada", () => {
    expect(enderecoDoConector("https://api.x.com.br/")).toBe("https://api.x.com.br/mcp");
    expect(enderecoDoConector("https://api.x.com.br")).toBe("https://api.x.com.br/mcp");
    expect(enderecoDoConector(undefined)).toBeNull();
    expect(enderecoDoConector("")).toBeNull();
  });

  it("nomeia as duas IAs e leva à ajuda oficial de cada uma", () => {
    expect(NOME_DA_IA).toEqual({ chatgpt: "ChatGPT", claude: "Claude" });
    expect(DOCUMENTACAO_DA_IA.chatgpt).toMatch(/^https:\/\/help\.openai\.com\//);
    expect(DOCUMENTACAO_DA_IA.claude).toMatch(/^https:\/\/support\.claude\.com\//);
    expect(ENDERECO_SEM_BASE).toBe("<endereço do conector>");
  });
});
