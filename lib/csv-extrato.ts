/**
 * Leitura e reescrita de CSV de extrato no navegador, antes do upload.
 *
 * O parser do backend (`app/parsers/csv.py`) exige colunas chamadas `data`,
 * `valor` e `descricao` (sem acento), valor com ponto decimal e sem milhar, e
 * não aceita dizer qual coluna é qual. Um arquivo fora disso falha inteiro, e o
 * motivo fica só no log do servidor. Então a checagem acontece aqui: o que já
 * está no formato sobe como está; o resto passa pela "Importação interrompida",
 * a pessoa aponta as colunas, e este módulo reescreve o arquivo no formato que
 * o backend lê.
 *
 * Funções puras, sem `window` nem `fetch`: é o pedaço que dá para testar com
 * arquivos de exemplo na mão.
 */

export type Tabela = { colunas: string[]; linhas: string[][] };

export type Papel = "data" | "historico" | "valor" | "ignorar";

/** O papel de cada coluna, pela posição (nome de coluna pode repetir). Null é "sem papel". */
export type Mapa = (Papel | null)[];

export type Lancamento = { linha: number; data: string; valor: string; descricao: string };

export type Problema = { linha: number; motivo: string };

export type Analise =
  | { pronto: true }
  | { pronto: false; motivo: "ilegivel"; mensagem: string }
  | {
      pronto: false;
      /** "colunas": falta coluna que o backend exige; "formato": as colunas estão lá, os valores não. */
      motivo: "colunas" | "formato";
      tabela: Tabela;
      delimitador: string;
      mapa: Mapa;
      faltando: Exclude<Papel, "ignorar">[];
    };

const DELIMITADORES = [";", ",", "\t", "|"];

export const NOME_DO_DELIMITADOR: Record<string, string> = {
  ";": "ponto e vírgula",
  ",": "vírgula",
  "\t": "tabulação",
  "|": "barra vertical",
};

/** UTF-8 primeiro; bytes que não formam UTF-8 válido são o Latin-1 dos ERPs. */
export function decodificar(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  // o Excel põe BOM no começo do CSV em UTF-8
  return texto.replace(/^﻿/, "");
}

function contarForaDeAspas(linha: string, delimitador: string): number {
  let aspas = false;
  let total = 0;
  for (const caractere of linha) {
    if (caractere === '"') aspas = !aspas;
    else if (caractere === delimitador && !aspas) total += 1;
  }
  return total;
}

/**
 * O separador que aparece no cabeçalho e se repete igual nas linhas seguintes.
 * Vírgula decimal ("12,00") não engana: ela varia de linha para linha.
 */
export function detectarDelimitador(texto: string): string | null {
  const linhas = texto.split(/\r?\n/).filter((linha) => linha.trim()).slice(0, 10);
  if (linhas.length === 0) return null;

  let melhor: { delimitador: string; iguais: number; colunas: number } | null = null;
  for (const delimitador of DELIMITADORES) {
    const contagens = linhas.map((linha) => contarForaDeAspas(linha, delimitador));
    if (contagens[0] === 0) continue;
    const iguais = contagens.filter((contagem) => contagem === contagens[0]).length;
    if (
      !melhor ||
      iguais > melhor.iguais ||
      (iguais === melhor.iguais && contagens[0] > melhor.colunas)
    ) {
      melhor = { delimitador, iguais, colunas: contagens[0] };
    }
  }
  return melhor?.delimitador ?? null;
}

/** CSV com aspas: separador, aspas dobradas e quebra de linha dentro do campo. */
export function lerTabela(texto: string, delimitador: string): Tabela {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  let aspas = false;

  for (let i = 0; i < texto.length; i++) {
    const caractere = texto[i];
    if (aspas) {
      if (caractere === '"' && texto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (caractere === '"') {
        aspas = false;
      } else {
        campo += caractere;
      }
    } else if (caractere === '"') {
      aspas = true;
    } else if (caractere === delimitador) {
      registro.push(campo);
      campo = "";
    } else if (caractere === "\n") {
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = "";
    } else if (caractere !== "\r") {
      campo += caractere;
    }
  }
  if (campo !== "" || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }

  const preenchidos = registros.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  const [cabecalho = [], ...linhas] = preenchidos;
  const colunas = cabecalho.map((nome) => nome.trim());
  return {
    colunas,
    linhas: linhas.map((linha) =>
      linha.length >= colunas.length
        ? linha
        : [...linha, ...Array<string>(colunas.length - linha.length).fill("")],
    ),
  };
}

/** O que o `Decimal(bruto.strip())` do backend aceita: ponto decimal, sem milhar. */
function valorQueOBackendLe(bruto: string): boolean {
  return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(bruto.trim());
}

/**
 * Valor como o ERP exporta → decimal com ponto: "1.500,75", "(980,00)",
 * "980,00-" e "R$ 7.912,40" viram "1500.75", "-980.00", "-980.00" e "7912.40".
 * Com um separador só, ele é o decimal — "1.500" vira 1,5, como no backend.
 */
export function normalizarValor(bruto: string): string | null {
  let texto = bruto.trim().replace(/^R\$/i, "").replace(/\s/g, "");
  let negativo = false;
  const entreParenteses = texto.match(/^\((.*)\)$/);
  if (entreParenteses) {
    negativo = true;
    texto = entreParenteses[1];
  } else if (texto.endsWith("-")) {
    negativo = true;
    texto = texto.slice(0, -1);
  } else if (texto.startsWith("-") || texto.startsWith("+")) {
    negativo = texto.startsWith("-");
    texto = texto.slice(1);
  }
  if (!/^[\d.,]+$/.test(texto) || !/\d/.test(texto)) return null;

  const ultimoPonto = texto.lastIndexOf(".");
  const ultimaVirgula = texto.lastIndexOf(",");
  let inteiro: string;
  let decimal = "";
  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    const separador = ultimoPonto > ultimaVirgula ? "." : ",";
    const milhar = separador === "." ? "," : ".";
    [inteiro, decimal] = [texto.slice(0, texto.lastIndexOf(separador)), texto.slice(texto.lastIndexOf(separador) + 1)];
    const agrupado = new RegExp(`^\\d{1,3}(\\${milhar}\\d{3})*$`);
    if (!agrupado.test(inteiro) || !/^\d+$/.test(decimal)) return null;
    inteiro = inteiro.split(milhar).join("");
  } else if (ultimoPonto >= 0 || ultimaVirgula >= 0) {
    const separador = ultimoPonto >= 0 ? "." : ",";
    const partes = texto.split(separador);
    if (partes.length === 2) {
      [inteiro, decimal] = partes;
    } else if (separador === "." && /^\d{1,3}(\.\d{3})+$/.test(texto)) {
      inteiro = partes.join(""); // "1.500.000": só milhar
    } else {
      return null;
    }
  } else {
    inteiro = texto;
  }
  if (inteiro === "") inteiro = "0";
  if (!/^\d+$/.test(inteiro) || (decimal !== "" && !/^\d+$/.test(decimal))) return null;

  const numero = decimal ? `${inteiro}.${decimal}` : inteiro;
  return negativo ? `-${numero}` : numero;
}

/** ISO, DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA e DD/MM/AA (com ou sem hora) → AAAA-MM-DD. */
export function normalizarData(bruto: string): string | null {
  const texto = bruto.trim().replace(/[ T]\d{1,2}:\d{2}(:\d{2})?$/, "");
  let ano: number;
  let mes: number;
  let dia: number;
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const brasileira = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (iso) {
    [ano, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (brasileira) {
    [dia, mes, ano] = [Number(brasileira[1]), Number(brasileira[2]), Number(brasileira[3])];
    if (brasileira[3].length === 2) ano += 2000;
  } else {
    return null;
  }
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null; // 31/02 ou mês 13
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function nomeSimples(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const PARECE_DATA = /^(data|dt|date)(_|$)|^data/;
const PARECE_DEBITO = /^(deb|debito|debitos|saida|saidas)(_|$)/;
const PARECE_CREDITO = /^(cred|credito|creditos|entrada|entradas)(_|$)/;
const PARECE_VALOR = /^(valor|vlr|vl|amount|montante|quantia)(_|$)/;
const PARECE_HISTORICO =
  /^(historico|hist|descricao|descr|desc|memo|complemento|detalhe|detalhes|lancamento|observacao|obs|favorecido|nome)(_|$)/;

/**
 * O papel que o nome da coluna sugere. Débito e crédito ficam "ambigua": o
 * design deixa a pessoa decidir se viram uma coluna de valor só.
 */
export function reconhecerColuna(nome: string): Papel | "ambigua" {
  const simples = nomeSimples(nome);
  if (PARECE_DATA.test(simples)) return "data";
  if (PARECE_DEBITO.test(simples) || PARECE_CREDITO.test(simples)) return "ambigua";
  if (PARECE_VALOR.test(simples)) return "valor";
  if (PARECE_HISTORICO.test(simples)) return "historico";
  return "ignorar";
}

/** O que dá para apontar sozinho: o primeiro de cada papel, o resto ignorado. */
export function sugerirMapa(tabela: Tabela): Mapa {
  const usados = new Set<Papel>();
  return tabela.colunas.map((nome) => {
    const papel = reconhecerColuna(nome);
    if (papel === "ambigua") return null;
    if (papel === "ignorar") return "ignorar";
    if (usados.has(papel)) return "ignorar";
    usados.add(papel);
    return papel;
  });
}

function contar(mapa: Mapa, papel: Papel): number {
  return mapa.filter((item) => item === papel).length;
}

/** Uma data, um histórico e uma ou duas colunas de valor (débito e crédito separados). */
export function mapaCompleto(mapa: Mapa): boolean {
  const valores = contar(mapa, "valor");
  return contar(mapa, "data") === 1 && contar(mapa, "historico") === 1 && valores >= 1 && valores <= 2;
}

// Soma de decimais em inteiro, na escala da maior parte decimal: somar
// "12604.00" e "0.00" em float daria resíduo, e aqui é dinheiro.
function casasDecimais(valor: string): number {
  return (valor.split(".")[1] ?? "").length;
}

function paraInteiro(valor: string, casas: number): bigint {
  const negativo = valor.startsWith("-");
  const [inteiro, decimal = ""] = valor.replace(/^-/, "").split(".");
  const numero = BigInt(inteiro + decimal.padEnd(casas, "0"));
  return negativo ? -numero : numero;
}

function deInteiro(numero: bigint, casas: number): string {
  const negativo = numero < BigInt(0);
  const digitos = (negativo ? -numero : numero).toString().padStart(casas + 1, "0");
  const texto = casas ? `${digitos.slice(0, -casas)}.${digitos.slice(-casas)}` : digitos;
  return negativo ? `-${texto}` : texto;
}

/** Nas duas colunas de valor, qual é a de débito: pelo nome, ou a primeira. */
function indiceDoDebito(tabela: Tabela, indices: number[]): number {
  const nomes = indices.map((indice) => nomeSimples(tabela.colunas[indice]));
  const debito = nomes.findIndex((nome) => PARECE_DEBITO.test(nome));
  if (debito >= 0) return indices[debito];
  const credito = nomes.findIndex((nome) => PARECE_CREDITO.test(nome));
  if (credito >= 0) return indices[1 - credito];
  return indices[0];
}

export type OpcoesValor = { inverterDebito: boolean };

/**
 * O valor de uma linha pelas colunas apontadas como valor. Com duas (débito e
 * crédito separados), elas viram uma só — o débito com o sinal invertido
 * quando `inverterDebito`.
 */
export function valorDaLinha(
  tabela: Tabela,
  mapa: Mapa,
  celulas: string[],
  { inverterDebito }: OpcoesValor,
): { valor: string } | { motivo: string } {
  const iValores = mapa.flatMap((papel, indice) => (papel === "valor" ? [indice] : []));
  const brutos = iValores.map((indice) => (celulas[indice] ?? "").trim());
  if (brutos.every((bruto) => bruto === "")) return { motivo: "Linha sem valor." };
  const ilegivel = brutos.find((bruto) => bruto !== "" && normalizarValor(bruto) === null);
  if (ilegivel !== undefined) return { motivo: `Valor que não dá para ler: "${ilegivel}".` };

  const valores = brutos.map((bruto) => (bruto === "" ? "0" : (normalizarValor(bruto) as string)));
  if (valores.length !== 2) return { valor: valores[0] };

  const iDebito = indiceDoDebito(tabela, iValores);
  const casas = Math.max(...valores.map(casasDecimais));
  const soma = iValores.reduce((total, indice, i) => {
    const parcela = paraInteiro(valores[i], casas);
    return total + (inverterDebito && indice === iDebito ? -parcela : parcela);
  }, BigInt(0));
  return { valor: deInteiro(soma, casas) };
}

/**
 * As linhas no formato do backend. A que não dá para ler fica de fora, com o
 * número que a pessoa vê abrindo o arquivo (a linha 1 é o cabeçalho).
 */
export function montarLancamentos(
  tabela: Tabela,
  mapa: Mapa,
  opcoes: OpcoesValor,
): { lancamentos: Lancamento[]; problemas: Problema[] } {
  const iData = mapa.indexOf("data");
  const iHistorico = mapa.indexOf("historico");

  const lancamentos: Lancamento[] = [];
  const problemas: Problema[] = [];
  tabela.linhas.forEach((celulas, posicao) => {
    const linha = posicao + 2;
    const data = normalizarData(celulas[iData] ?? "");
    if (!data) {
      problemas.push({ linha, motivo: `Data que não dá para ler: "${(celulas[iData] ?? "").trim()}".` });
      return;
    }
    const valor = valorDaLinha(tabela, mapa, celulas, opcoes);
    if ("motivo" in valor) {
      problemas.push({ linha, motivo: valor.motivo });
      return;
    }
    lancamentos.push({ linha, data, valor: valor.valor, descricao: (celulas[iHistorico] ?? "").trim() });
  });
  return { lancamentos, problemas };
}

function campoCsv(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** O CSV que o backend lê: `data;valor;descricao`, data ISO, ponto decimal, UTF-8. */
export function gerarCsv(lancamentos: Lancamento[]): string {
  const linhas = lancamentos.map(
    (lancamento) => `${lancamento.data};${lancamento.valor};${campoCsv(lancamento.descricao)}`,
  );
  return `data;valor;descricao\n${linhas.map((linha) => `${linha}\n`).join("")}`;
}

function ilegivel(mensagem: string): Analise {
  return { pronto: false, motivo: "ilegivel", mensagem };
}

/**
 * Passa pelas mesmas regras do backend. Pronto é o arquivo que ele lê sem
 * perder linha; o resto volta com a tabela e o mapa sugerido.
 */
export function analisarCsv(bytes: Uint8Array): Analise {
  const texto = decodificar(bytes);
  if (!texto.trim()) return ilegivel("O arquivo está vazio.");

  const delimitador = detectarDelimitador(texto);
  if (!delimitador) {
    return ilegivel(
      "Não encontramos o separador das colunas. O CSV precisa ter as colunas separadas por ponto e vírgula, vírgula ou tabulação.",
    );
  }

  const tabela = lerTabela(texto, delimitador);
  if (tabela.linhas.length === 0) {
    return ilegivel("O arquivo tem só o cabeçalho, sem nenhum lançamento.");
  }

  const nomes = tabela.colunas.map((nome) => nome.toLowerCase());
  const [iData, iValor, iDescricao] = ["data", "valor", "descricao"].map((nome) => nomes.indexOf(nome));
  const colunasCertas = iData >= 0 && iValor >= 0 && iDescricao >= 0;
  if (
    colunasCertas &&
    tabela.linhas.every(
      (linha) => normalizarData(linha[iData]) !== null && valorQueOBackendLe(linha[iValor]),
    )
  ) {
    return { pronto: true };
  }

  const mapa = sugerirMapa(tabela);
  const faltando = (["data", "historico", "valor"] as const).filter((papel) => !mapa.includes(papel));
  return {
    pronto: false,
    motivo: colunasCertas ? "formato" : "colunas",
    tabela,
    delimitador,
    mapa,
    faltando,
  };
}
