import { describe, expect, it } from "vitest";
import {
  COOKIE_DA_EMPRESA_RECENTE,
  SECOES,
  caminhoSemEmpresa,
  comEmpresa,
  destinoDaTroca,
  destinoDaUrlAntiga,
  ehDaEmpresa,
  ehUuid,
  empresaDoCaminho,
  escolherEmpresa,
  secaoDoCaminho,
} from "./rotas";

const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const B = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("constantes", () => {
  it("as seções são as telas da empresa, e o cookie tem o nome combinado", () => {
    expect([...SECOES].sort()).toEqual(
      ["assinatura", "conciliacoes", "dashboard", "empresas", "extratos", "fechamentos", "historico", "regras", "visao-geral"].sort(),
    );
    expect(COOKIE_DA_EMPRESA_RECENTE).toBe("ledgr-empresa-recente");
  });
});

describe("ehUuid", () => {
  it("aceita 8-4-4-4-12 em hexadecimal, em qualquer caixa", () => {
    expect(ehUuid(A)).toBe(true);
    expect(ehUuid(A.toUpperCase())).toBe(true);
  });

  it("recusa o que não é UUID", () => {
    for (const valor of ["", "abc", "not-uuid", `${A}x`, ` ${A}`, A.replaceAll("-", ""), "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b2g"]) {
      expect(ehUuid(valor)).toBe(false);
    }
  });
});

describe("empresaDoCaminho e caminhoSemEmpresa", () => {
  it("lê a empresa do prefixo, com ou sem resto, com ou sem query", () => {
    expect(empresaDoCaminho(`/e/${A}`)).toBe(A);
    expect(empresaDoCaminho(`/e/${A}/fechamentos?mes=2026-09`)).toBe(A);
    expect(empresaDoCaminho(`/e/${A}?x=1`)).toBe(A);
  });

  it("sem prefixo válido não há empresa", () => {
    expect(empresaDoCaminho("/e/abc/fechamentos")).toBeNull();
    expect(empresaDoCaminho("/fechamentos")).toBeNull();
    expect(empresaDoCaminho(`/x/e/${A}/fechamentos`)).toBeNull();
    expect(empresaDoCaminho(`/e/${A}extra/fechamentos`)).toBeNull();
    expect(empresaDoCaminho("/")).toBeNull();
  });

  it("tira o prefixo e guarda o resto, query inclusive", () => {
    expect(caminhoSemEmpresa(`/e/${A}`)).toBe("/");
    expect(caminhoSemEmpresa(`/e/${A}/`)).toBe("/");
    expect(caminhoSemEmpresa(`/e/${A}/conciliacoes/x?sistema=y`)).toBe("/conciliacoes/x?sistema=y");
    expect(caminhoSemEmpresa(`/e/${A}?x=1`)).toBe("/?x=1");
  });

  it("o que não tem prefixo válido volta igual", () => {
    expect(caminhoSemEmpresa("/e/abc/x")).toBe("/e/abc/x");
    expect(caminhoSemEmpresa("/visao-geral")).toBe("/visao-geral");
  });
});

describe("ehDaEmpresa e secaoDoCaminho", () => {
  it("é da empresa o que começa por uma seção, com ou sem prefixo, query ou hash", () => {
    expect(ehDaEmpresa("/fechamentos")).toBe(true);
    expect(ehDaEmpresa("/conciliacoes/nova")).toBe(true);
    expect(ehDaEmpresa("/fechamentos?mes=2026-09")).toBe(true);
    expect(ehDaEmpresa("/extratos#topo")).toBe(true);
    expect(ehDaEmpresa(`/e/${A}/historico`)).toBe(true);
  });

  it("não é da empresa o que fica fora do app", () => {
    for (const caminho of ["/login", "/cadastro", "/ajuda/extratos", "/plano", "/termos", "/privacidade", "/", "/fechamentos-x", "/api/conciliacoes/x/exportar"]) {
      expect(ehDaEmpresa(caminho)).toBe(false);
    }
  });

  it("acha a seção", () => {
    expect(secaoDoCaminho(`/e/${A}/fechamentos/2026-09/relatorio`)).toBe("fechamentos");
    expect(secaoDoCaminho("/dashboard?x=1")).toBe("dashboard");
    expect(secaoDoCaminho("/login")).toBeNull();
    expect(secaoDoCaminho("/")).toBeNull();
  });
});

describe("comEmpresa", () => {
  it("prefixa as telas da empresa, mantendo query e hash", () => {
    expect(comEmpresa(A, "/fechamentos?mes=2026-09")).toBe(`/e/${A}/fechamentos?mes=2026-09`);
    expect(comEmpresa(A, "/extratos#topo")).toBe(`/e/${A}/extratos#topo`);
    expect(comEmpresa(A, "/conciliacoes/nova")).toBe(`/e/${A}/conciliacoes/nova`);
  });

  it("deixa como está o que não é tela da empresa", () => {
    expect(comEmpresa(A, "/login")).toBe("/login");
    expect(comEmpresa(A, "/ajuda/visao-geral")).toBe("/ajuda/visao-geral");
    expect(comEmpresa(A, "/plano")).toBe("/plano");
    expect(comEmpresa(A, "https://exemplo.com/fechamentos")).toBe("https://exemplo.com/fechamentos");
  });

  it("é idempotente e não troca um prefixo que já existe", () => {
    expect(comEmpresa(A, `/e/${A}/extratos`)).toBe(`/e/${A}/extratos`);
    expect(comEmpresa(A, `/e/${B}/extratos`)).toBe(`/e/${B}/extratos`);
  });
});

describe("destinoDaTroca", () => {
  it("mantém a tela quando ela não tem id", () => {
    expect(destinoDaTroca(`/e/${A}/fechamentos`, B)).toBe(`/e/${B}/fechamentos`);
    expect(destinoDaTroca(`/e/${A}/visao-geral`, B)).toBe(`/e/${B}/visao-geral`);
    expect(destinoDaTroca(`/e/${A}/conciliacoes/nova`, B)).toBe(`/e/${B}/conciliacoes/nova`);
    expect(destinoDaTroca(`/e/${A}/fechamentos?mes=2026-09`, B)).toBe(`/e/${B}/fechamentos`);
  });

  it("de uma tela com id vai à raiz da seção, porque o id não existe no outro cliente", () => {
    expect(destinoDaTroca(`/e/${A}/conciliacoes/${A}?sistema=${A}`, B)).toBe(`/e/${B}/dashboard`);
    expect(destinoDaTroca(`/e/${A}/conciliacoes/${A}/${A}`, B)).toBe(`/e/${B}/dashboard`);
    expect(destinoDaTroca(`/e/${A}/fechamentos/2026-09/relatorio`, B)).toBe(`/e/${B}/fechamentos`);
  });

  it("sem seção conhecida cai na visão geral", () => {
    expect(destinoDaTroca(`/e/${A}`, B)).toBe(`/e/${B}/visao-geral`);
    expect(destinoDaTroca("/qualquer", B)).toBe(`/e/${B}/visao-geral`);
  });
});

describe("escolherEmpresa", () => {
  const lista = [{ id: A }, { id: B }];

  it("usa a recente se estiver na lista, senão a primeira, senão nenhuma", () => {
    expect(escolherEmpresa(lista, B)).toBe(B);
    expect(escolherEmpresa(lista, "lixo")).toBe(A);
    expect(escolherEmpresa(lista, undefined)).toBe(A);
    expect(escolherEmpresa([], B)).toBeNull();
  });
});

describe("a tela Empresas é uma tela da empresa", () => {
  it("leva o prefixo da empresa, que se tira de volta, e a URL antiga redireciona", () => {
    expect(comEmpresa(A, "/empresas")).toBe(`/e/${A}/empresas`);
    expect(caminhoSemEmpresa(`/e/${A}/empresas`)).toBe("/empresas");
    expect(destinoDaUrlAntiga("empresas", undefined, {}, A)).toBe(`/e/${A}/empresas`);
  });
});

describe("destinoDaUrlAntiga", () => {
  it("monta o destino com o resto e a query", () => {
    expect(destinoDaUrlAntiga("fechamentos", undefined, { mes: "2026-09" }, A)).toBe(`/e/${A}/fechamentos?mes=2026-09`);
    expect(destinoDaUrlAntiga("conciliacoes", ["nova"], {}, A)).toBe(`/e/${A}/conciliacoes/nova`);
    expect(destinoDaUrlAntiga("conciliacoes", [B], { sistema: A }, A)).toBe(`/e/${A}/conciliacoes/${B}?sistema=${A}`);
    expect(destinoDaUrlAntiga("extratos", [], {}, A)).toBe(`/e/${A}/extratos`);
  });

  it("repete a chave de uma query com vários valores e ignora a que está vazia", () => {
    expect(destinoDaUrlAntiga("extratos", undefined, { a: ["1", "2"], b: undefined }, A)).toBe(`/e/${A}/extratos?a=1&a=2`);
  });

  it("não sai do site: redirect aberto e travessia dão null", () => {
    for (const resto of [[""], [".."], ["."], ["a/b"], ["%2f%2fevil.com"], ["\\evil"], ["http:"], ["a", ""], ["//evil.com"]]) {
      expect(destinoDaUrlAntiga("extratos", resto, {}, A)).toBeNull();
    }
  });

  it("só as seções existem", () => {
    expect(destinoDaUrlAntiga("login", undefined, {}, A)).toBeNull();
    expect(destinoDaUrlAntiga("e", [A], {}, A)).toBeNull();
    expect(destinoDaUrlAntiga("", undefined, {}, A)).toBeNull();
  });
});
