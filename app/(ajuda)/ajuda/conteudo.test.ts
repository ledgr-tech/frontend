import { describe, expect, it } from "vitest";
import { conteudoDaAjuda } from "./conteudo";
import { PAGINAS } from "./paginas";
import { GET } from "./conteudo.json/route";

// o que o backend valida (backend #137, app/services/ajuda/conteudo.py): ids, títulos e o tamanho no contexto
const IDENTIFICADOR = /^[a-z0-9][a-z0-9-]*$/;
const MAXIMO_NO_CONTEXTO = 60_000;

describe("conteudoDaAjuda", () => {
  const conteudo = conteudoDaAjuda(PAGINAS);

  it("tem cada página e cada função da Central, com ids que o backend aceita", () => {
    expect(conteudo.paginas.map((pagina) => pagina.id)).toEqual(PAGINAS.map((pagina) => pagina.id));
    for (const pagina of conteudo.paginas) {
      expect(pagina.id).toMatch(IDENTIFICADOR);
      expect(pagina.id.length).toBeLessThanOrEqual(64);
      expect(pagina.titulo.length).toBeGreaterThan(0);
      for (const funcao of pagina.funcoes) {
        expect(funcao.id).toMatch(IDENTIFICADOR);
        expect(funcao.titulo.length).toBeGreaterThan(0);
      }
    }
  });

  it("leva só o texto: sem capa, imagem nem vídeo", () => {
    const texto = JSON.stringify(conteudo);
    expect(texto).not.toContain("capa");
    expect(texto).not.toContain("imagem");
    expect(texto).not.toContain(".webp");
  });

  it("cabe no contexto do assistente, contando o escape de < e > que o backend faz", () => {
    const comoOBackendSerializa = JSON.stringify(conteudo).replace(/[<>]/g, "\\u003c");
    expect(comoOBackendSerializa.length).toBeLessThan(MAXIMO_NO_CONTEXTO);
  });

  it("a versão muda só quando o texto muda", () => {
    expect(conteudoDaAjuda(PAGINAS).versao).toBe(conteudo.versao);
    const mudada = PAGINAS.map((pagina, indice) => (indice === 0 ? { ...pagina, serve: `${pagina.serve}!` } : pagina));
    expect(conteudoDaAjuda(mudada).versao).not.toBe(conteudo.versao);
  });

  it("a rota publica o mesmo JSON", async () => {
    expect(await GET().json()).toEqual(conteudo);
  });
});
