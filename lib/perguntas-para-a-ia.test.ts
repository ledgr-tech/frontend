import { describe, expect, it } from "vitest";
import { PERGUNTAS, TEMAS, perguntasDisponiveis, type PerguntaSugerida } from "./perguntas-para-a-ia";

describe("perguntasDisponiveis", () => {
  it("mantém as 17 perguntas com ids únicos e libera só as nove disponíveis hoje", () => {
    expect(PERGUNTAS).toHaveLength(17);
    expect(new Set(PERGUNTAS.map((pergunta) => pergunta.id)).size).toBe(17);
    expect(perguntasDisponiveis().flatMap((grupo) => grupo.perguntas.map((pergunta) => pergunta.id)))
      .toEqual(["1", "4", "5", "8", "10", "13", "15", "16", "17"]);
  });

  it("nunca libera perguntas que aguardam ferramenta, mesmo com todas as opções ligadas", () => {
    const disponiveis = perguntasDisponiveis(["descricoes"]).flatMap((grupo) => grupo.perguntas);
    const escondidas = PERGUNTAS.filter((pergunta) => pergunta.requer && "ferramenta" in pergunta.requer);
    expect(escondidas).toHaveLength(8);
    for (const pergunta of escondidas) expect(disponiveis).not.toContain(pergunta);
    expect(escondidas.map(({ id, requer }) => [id, requer])).toEqual([
      ["2", { ferramenta: "visao_do_mes" }],
      ["3", { ferramenta: "visao_do_mes" }],
      ["6", { ferramenta: "divergencias_ordenadas" }],
      ["7", { ferramenta: "divergencias_ordenadas" }],
      ["9", { ferramenta: "detalhe_da_divergencia" }],
      ["11", { ferramenta: "grupos_do_mes" }],
      ["12", { ferramenta: "lancamentos_do_mes" }],
      ["14", { ferramenta: "lancamentos_do_mes" }],
    ]);
  });

  it("só libera requer.opcao quando a opção está ligada", () => {
    const pergunta: PerguntaSugerida = {
      id: "teste-opcao", tema: "resumo", texto: "Pergunta de teste", requer: { opcao: "descricoes" },
    };
    PERGUNTAS.push(pergunta);
    try {
      expect(perguntasDisponiveis().flatMap((grupo) => grupo.perguntas)).not.toContain(pergunta);
      expect(perguntasDisponiveis(["descricoes"]).flatMap((grupo) => grupo.perguntas)).toContain(pergunta);
    } finally {
      PERGUNTAS.pop();
    }
  });

  it("agrupa na ordem dos temas e omite temas sem perguntas disponíveis", () => {
    expect(perguntasDisponiveis().map(({ tema, titulo }) => ({ id: tema, titulo }))).toEqual(TEMAS);
    expect(TEMAS.map((tema) => tema.titulo)).toEqual(["Visão do mês", "Divergências", "Lançamentos", "Fechamento", "Resumo"]);
    const indice = PERGUNTAS.findIndex((pergunta) => pergunta.id === "13");
    const original = PERGUNTAS[indice];
    PERGUNTAS[indice] = { ...original, requer: { ferramenta: "teste" } };
    try {
      const grupos = perguntasDisponiveis();
      expect(grupos.map((grupo) => grupo.tema)).toEqual(["visao-do-mes", "divergencias", "fechamento", "resumo"]);
      expect(grupos.every((grupo) => grupo.perguntas.length > 0)).toBe(true);
    } finally {
      PERGUNTAS[indice] = original;
    }
  });
});
