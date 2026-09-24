import { describe, expect, it } from "vitest";
import {
  analisarCsv,
  decodificar,
  detectarDelimitador,
  gerarCsv,
  lerTabela,
  mapaCompleto,
  montarLancamentos,
  normalizarData,
  normalizarValor,
  reconhecerColuna,
  sugerirMapa,
  type Tabela,
} from "./csv-extrato";

const utf8 = (texto: string) => new TextEncoder().encode(texto);

/** Latin-1 na mão: cada caractere até 255 vira um byte (é o que o Cigam exporta). */
const latin1 = (texto: string) => Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));

// O layout do design: débito e crédito em colunas separadas, vírgula decimal.
const CIGAM = [
  "DT_LANC;HISTORICO;DOC;DEB;CRED;CTA_CONTABIL",
  "04/09/2026;Boleto Aço Norte;00071.4482-9;12.604,00;0,00;2.01.01",
  "05/09/2026;Repasse cartão D+30;4471;0,00;7.912,40;1.01.02",
  "15/09/2026;Folha de setembro;FP-09;38.420,17;0,00;3.01.01",
].join("\n");

describe("decodificar", () => {
  it("lê UTF-8 e tira o BOM que o Excel põe no começo", () => {
    expect(decodificar(utf8("﻿data;descrição"))).toBe("data;descrição");
  });

  it("cai para Latin-1 quando os bytes não são UTF-8 válido", () => {
    expect(decodificar(latin1("HISTORICO;Aço Norte"))).toBe("HISTORICO;Aço Norte");
  });
});

describe("detectarDelimitador", () => {
  it("acha o ponto e vírgula mesmo com vírgula decimal nos valores", () => {
    expect(detectarDelimitador(CIGAM)).toBe(";");
  });

  it("acha a vírgula e a tabulação", () => {
    expect(detectarDelimitador("data,valor,descricao\n2026-09-04,10.00,Pix")).toBe(",");
    expect(detectarDelimitador("data\tvalor\tdescricao\n2026-09-04\t10.00\tPix")).toBe("\t");
  });

  it("não chuta quando não há separador nenhum", () => {
    expect(detectarDelimitador("só uma coluna\noutra linha")).toBeNull();
  });
});

describe("lerTabela", () => {
  it("respeita aspas: separador e quebra de linha dentro do campo não cortam a coluna", () => {
    const tabela = lerTabela('data;descricao;valor\n2026-09-04;"Pix; ref ""A""\nsegunda linha";10.00\n', ";");
    expect(tabela).toEqual({
      colunas: ["data", "descricao", "valor"],
      linhas: [["2026-09-04", 'Pix; ref "A"\nsegunda linha', "10.00"]],
    });
  });

  it("ignora linha em branco e completa linha curta", () => {
    expect(lerTabela("a;b;c\r\n1;2\r\n\r\n", ";").linhas).toEqual([["1", "2", ""]]);
  });
});

describe("normalizarValor", () => {
  it.each([
    ["1.500,75", "1500.75"],
    ["12.604,00", "12604.00"],
    ["1500,75", "1500.75"],
    ["1,500.75", "1500.75"],
    ["1500.75", "1500.75"],
    ["-980,00", "-980.00"],
    ["(980,00)", "-980.00"],
    ["980,00-", "-980.00"],
    ["R$ 7.912,40", "7912.40"],
    ["0", "0"],
  ])("%s → %s", (bruto, esperado) => {
    expect(normalizarValor(bruto)).toBe(esperado);
  });

  it("devolve null para o que não é número", () => {
    expect(normalizarValor("abc")).toBeNull();
    expect(normalizarValor("")).toBeNull();
    expect(normalizarValor("12,604,00")).toBeNull();
  });
});

describe("normalizarData", () => {
  it.each([
    ["2026-09-04", "2026-09-04"],
    ["04/09/2026", "2026-09-04"],
    ["4/9/2026", "2026-09-04"],
    ["04-09-2026", "2026-09-04"],
    ["04.09.2026", "2026-09-04"],
    ["04/09/26", "2026-09-04"],
  ])("%s → %s", (bruto, esperado) => {
    expect(normalizarData(bruto)).toBe(esperado);
  });

  it("recusa data que não existe", () => {
    expect(normalizarData("31/02/2026")).toBeNull();
    expect(normalizarData("2026-13-01")).toBeNull();
    expect(normalizarData("ontem")).toBeNull();
  });
});

describe("reconhecerColuna", () => {
  it.each([
    ["DT_LANC", "data"],
    ["Data", "data"],
    ["data_movimento", "data"],
    ["HISTORICO", "historico"],
    ["Descrição", "historico"],
    ["valor", "valor"],
    ["VLR_LANCAMENTO", "valor"],
    ["DEB", "ambigua"],
    ["Crédito", "ambigua"],
    ["CTA_CONTABIL", "ignorar"],
    ["DOC", "ignorar"],
  ])("%s → %s", (nome, papel) => {
    expect(reconhecerColuna(nome)).toBe(papel);
  });
});

describe("sugerirMapa", () => {
  it("aponta o que reconhece e deixa débito e crédito para a pessoa decidir", () => {
    const tabela = lerTabela(CIGAM, ";");
    expect(sugerirMapa(tabela)).toEqual(["data", "historico", "ignorar", null, null, "ignorar"]);
  });

  it("não aponta duas colunas de data", () => {
    const tabela: Tabela = { colunas: ["data", "data_compensacao", "valor", "historico"], linhas: [] };
    expect(sugerirMapa(tabela)).toEqual(["data", "ignorar", "valor", "historico"]);
  });
});

describe("mapaCompleto", () => {
  it("pede uma data, um histórico e uma ou duas colunas de valor", () => {
    expect(mapaCompleto(["data", "historico", "valor"])).toBe(true);
    expect(mapaCompleto(["data", "historico", "valor", "valor"])).toBe(true);
    expect(mapaCompleto(["data", "historico", null])).toBe(false);
    expect(mapaCompleto(["data", "valor", "ignorar"])).toBe(false);
    expect(mapaCompleto(["data", "historico", "valor", "valor", "valor"])).toBe(false);
  });
});

describe("montarLancamentos", () => {
  const tabela = lerTabela(CIGAM, ";");

  it("une débito e crédito num valor só, com o débito negativo", () => {
    const { lancamentos, problemas } = montarLancamentos(
      tabela,
      ["data", "historico", "ignorar", "valor", "valor", "ignorar"],
      { inverterDebito: true },
    );
    expect(problemas).toEqual([]);
    expect(lancamentos).toEqual([
      { linha: 2, data: "2026-09-04", valor: "-12604.00", descricao: "Boleto Aço Norte" },
      { linha: 3, data: "2026-09-05", valor: "7912.40", descricao: "Repasse cartão D+30" },
      { linha: 4, data: "2026-09-15", valor: "-38420.17", descricao: "Folha de setembro" },
    ]);
  });

  it("soma as duas colunas como vieram quando o sinal já está no arquivo", () => {
    const comSinal: Tabela = {
      colunas: ["data", "historico", "saida", "entrada"],
      linhas: [["04/09/2026", "Boleto", "-100,00", "0,00"]],
    };
    const { lancamentos } = montarLancamentos(comSinal, ["data", "historico", "valor", "valor"], {
      inverterDebito: false,
    });
    expect(lancamentos[0].valor).toBe("-100.00");
  });

  it("deixa de fora, com o motivo, a linha que não dá para ler", () => {
    const comLixo: Tabela = {
      colunas: ["data", "historico", "valor"],
      linhas: [
        ["04/09/2026", "Pix", "10,00"],
        ["amanhã", "Pix", "10,00"],
        ["05/09/2026", "Pix", "dez reais"],
      ],
    };
    const { lancamentos, problemas } = montarLancamentos(comLixo, ["data", "historico", "valor"], {
      inverterDebito: true,
    });
    expect(lancamentos.map((l) => l.linha)).toEqual([2]);
    // linha 1 é o cabeçalho: a numeração bate com o que a pessoa vê no editor
    expect(problemas).toEqual([
      { linha: 3, motivo: 'Data que não dá para ler: "amanhã".' },
      { linha: 4, motivo: 'Valor que não dá para ler: "dez reais".' },
    ]);
  });
});

describe("gerarCsv", () => {
  it("escreve no formato que o backend lê, com aspas só onde precisa", () => {
    const csv = gerarCsv([
      { linha: 2, data: "2026-09-04", valor: "-12604.00", descricao: "Boleto Aço Norte" },
      { linha: 3, data: "2026-09-05", valor: "7912.40", descricao: 'Repasse; ref "A"' },
    ]);
    expect(csv).toBe(
      'data;valor;descricao\n2026-09-04;-12604.00;Boleto Aço Norte\n2026-09-05;7912.40;"Repasse; ref ""A"""\n',
    );
  });
});

describe("analisarCsv", () => {
  it("deixa passar o arquivo que o backend já lê", () => {
    const pronto = utf8("data;valor;descricao\n2026-09-04;-12604.00;Boleto\n05/09/2026;7912.40;Repasse\n");
    expect(analisarCsv(pronto)).toEqual({ pronto: true });
  });

  it("para o arquivo sem as colunas que o backend exige, com o mapa sugerido", () => {
    const analise = analisarCsv(latin1(CIGAM));
    expect(analise).toMatchObject({
      pronto: false,
      motivo: "colunas",
      delimitador: ";",
      mapa: ["data", "historico", "ignorar", null, null, "ignorar"],
      faltando: ["valor"],
    });
    if (analise.pronto || analise.motivo === "ilegivel") throw new Error("devia ter a tabela");
    expect(analise.tabela.linhas).toHaveLength(3);
    // o Latin-1 foi lido direito
    expect(analise.tabela.linhas[0][1]).toBe("Boleto Aço Norte");
  });

  it("para o arquivo com as colunas certas mas valor com vírgula decimal", () => {
    const analise = analisarCsv(utf8("data;valor;descricao\n04/09/2026;1.500,75;Pix\n"));
    expect(analise).toMatchObject({
      pronto: false,
      motivo: "formato",
      mapa: ["data", "valor", "historico"],
      faltando: [],
    });
  });

  it("explica o arquivo que nem dá para ler como tabela", () => {
    expect(analisarCsv(utf8(""))).toEqual({
      pronto: false,
      motivo: "ilegivel",
      mensagem: "O arquivo está vazio.",
    });
    expect(analisarCsv(utf8("uma coluna só\nsem separador"))).toMatchObject({
      pronto: false,
      motivo: "ilegivel",
    });
    expect(analisarCsv(utf8("data;valor;descricao\n"))).toEqual({
      pronto: false,
      motivo: "ilegivel",
      mensagem: "O arquivo tem só o cabeçalho, sem nenhum lançamento.",
    });
  });
});
