"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NOME_DO_DELIMITADOR,
  gerarCsv,
  mapaCompleto,
  montarLancamentos,
  normalizarData,
  reconhecerColuna,
  valorDaLinha,
  type Analise,
  type Mapa,
  type Papel,
} from "@/lib/csv-extrato";
import { formatarInteiro } from "../../dashboard/resumo";

/**
 * "Importação interrompida" e "De quais colunas o Ledgr precisa", do design.
 *
 * Aparece antes de qualquer upload, quando o CSV não está no formato que o
 * backend lê. A pessoa aponta as colunas; ao confirmar, o arquivo é reescrito
 * aqui mesmo (`lib/csv-extrato.ts`) e segue para o upload com o mesmo nome.
 *
 * Do design ficou de fora "Lembrar deste layout": sem backend para guardar o
 * mapeamento, ele valeria só neste navegador.
 */

type Parada = Extract<Analise, { motivo: "colunas" | "formato" }>;

const PAPEIS: { papel: Papel; rotulo: string }[] = [
  { papel: "data", rotulo: "Data" },
  { papel: "historico", rotulo: "Histórico" },
  { papel: "valor", rotulo: "Valor" },
  { papel: "ignorar", rotulo: "Ignorar" },
];

const ROTULO: Record<Papel, string> = {
  data: "Data",
  historico: "Histórico",
  valor: "Valor",
  ignorar: "Ignorada",
};

const NOME_DO_PAPEL = { data: "data", historico: "histórico", valor: "valor" } as const;

const LINHAS_NA_PREVIA = 4;
const PROBLEMAS_LISTADOS = 5;

const cinza = (opacidade: number) =>
  `color-mix(in srgb, var(--color-text) ${opacidade}%, transparent)`;

function listar(itens: string[]): string {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

function explicacao(analise: Parada, origem: "banco" | "sistema"): string {
  const arquivo = `o arquivo do ${origem}`;
  const seguir =
    " Nada foi enviado. Aponte quais colunas têm a data, o histórico e o valor, e o Ledgr ajusta o arquivo antes de enviar.";
  if (analise.motivo === "formato") {
    return `As colunas d${arquivo.slice(1)} estão lá, mas os valores ou as datas estão num formato que o Ledgr ainda não lê direto (como 1.500,75). Nada foi enviado. Confirme as colunas e o Ledgr ajusta o arquivo antes de enviar.`;
  }
  const faltando = analise.faltando.map((papel) => NOME_DO_PAPEL[papel]);
  if (faltando.length === 0) {
    return `As colunas d${arquivo.slice(1)} não têm os nomes que o Ledgr lê direto.${seguir}`;
  }
  const qual =
    faltando.length === 1
      ? `uma coluna de ${faltando[0]} reconhecível`
      : `colunas de ${listar(faltando)} reconhecíveis`;
  return `O ${arquivo.slice(2)} não tem ${qual}.${seguir}`;
}

function formatarValor(valor: string): string {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SemColuna() {
  return <em style={{ color: "var(--color-accent-700)" }}>sem coluna</em>;
}

export function ImportacaoInterrompida({
  nome,
  origem,
  analise,
  onPronto,
  onOutroArquivo,
}: {
  nome: string;
  origem: "banco" | "sistema";
  analise: Parada;
  onPronto: (arquivo: File) => void;
  onOutroArquivo: () => void;
}) {
  const [etapa, setEtapa] = useState<"diagnostico" | "mapa">("diagnostico");
  const [mapa, setMapa] = useState<Mapa>(analise.mapa);
  const [inverterDebito, setInverterDebito] = useState(true);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeiraVez = useRef(true);

  // ao trocar de etapa o foco vai para o título novo, para o leitor de tela anunciar
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    titulo.current?.focus();
  }, [etapa]);

  const { tabela } = analise;
  const linhas = tabela.linhas.length;
  const subtitulo = `${nome} · ${formatarInteiro(linhas)} ${linhas === 1 ? "linha" : "linhas"} · ${
    NOME_DO_DELIMITADOR[analise.delimitador] ?? analise.delimitador
  }`;

  const completo = mapaCompleto(mapa);
  const resultado = useMemo(
    () => (completo ? montarLancamentos(tabela, mapa, { inverterDebito }) : null),
    [completo, tabela, mapa, inverterDebito],
  );
  const colunasDeValor = mapa.filter((papel) => papel === "valor").length;
  const pronto = resultado !== null && resultado.lancamentos.length > 0;

  function definirPapel(indice: number, papel: Papel) {
    setMapa((atual) => {
      // data e histórico são de uma coluna só; valor pode repetir (débito e crédito)
      const novo = atual.map((item) =>
        (papel === "data" || papel === "historico") && item === papel ? null : item,
      );
      novo[indice] = atual[indice] === papel ? null : papel;
      return novo;
    });
  }

  function confirmar() {
    if (!resultado || !pronto) return;
    onPronto(new File([gerarCsv(resultado.lancamentos)], nome, { type: "text/csv" }));
  }

  const cabecalho = (
    <>
      <h6 style={{ margin: "0 0 6px", color: "var(--color-accent-700)" }}>Importação interrompida</h6>
      <span style={{ fontSize: 14, color: cinza(62), overflowWrap: "anywhere" }}>{subtitulo}</span>
    </>
  );

  if (etapa === "diagnostico") {
    return (
      <div className="importacao">
        <div>{cabecalho}</div>
        <div>
          <h1 ref={titulo} tabIndex={-1} className="importacao-titulo">
            Não deu para conciliar
          </h1>
          <p className="importacao-texto">{explicacao(analise, origem)}</p>
        </div>

        <div>
          <h3 id="colunas-encontradas" style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 600 }}>
            Colunas encontradas no arquivo
          </h3>
          <div className="dash-tabela-rolagem">
            <table className="table" aria-labelledby="colunas-encontradas">
              <thead>
                <tr>
                  <th>Coluna do arquivo</th>
                  <th>Interpretada como</th>
                  <th>Primeira linha</th>
                  <th style={{ textAlign: "right" }}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {tabela.colunas.map((coluna, indice) => {
                  const reconhecida = reconhecerColuna(coluna);
                  const papel = analise.mapa[indice];
                  const ambigua = reconhecida === "ambigua" && papel === null;
                  const situacao = ambigua ? "Ambígua" : papel === "ignorar" ? "Não usada" : "Reconhecida";
                  return (
                    <tr key={`${coluna}-${indice}`} data-pendente={ambigua ? "true" : undefined}>
                      <td style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{coluna}</td>
                      <td>{papel === null ? "—" : ROTULO[papel]}</td>
                      <td style={{ overflowWrap: "anywhere" }}>{tabela.linhas[0]?.[indice] ?? ""}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={ambigua ? "selo selo-atencao" : "selo"}>{situacao}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="importacao-acoes">
          <button type="button" className="btn btn-primary" onClick={() => setEtapa("mapa")}>
            Apontar as colunas
          </button>
          <button type="button" className="btn btn-secondary" onClick={onOutroArquivo}>
            Subir outro arquivo
          </button>
        </div>
      </div>
    );
  }

  const falta = (["data", "historico", "valor"] as const).find((papel) => !mapa.includes(papel));
  const aviso = falta
    ? `Falta apontar a coluna de ${NOME_DO_PAPEL[falta]}.`
    : colunasDeValor > 2
      ? "Aponte no máximo duas colunas de valor: débito e crédito."
      : colunasDeValor === 2
        ? "Débito e crédito serão unidos em uma coluna de valor."
        : null;

  const iData = mapa.indexOf("data");
  const iHistorico = mapa.indexOf("historico");
  const previa = tabela.linhas.slice(0, LINHAS_NA_PREVIA).map((celulas) => {
    const data = iData >= 0 ? normalizarData(celulas[iData] ?? "") : null;
    const valor = colunasDeValor > 0 && colunasDeValor <= 2
      ? valorDaLinha(tabela, mapa, celulas, { inverterDebito })
      : null;
    return {
      data: iData < 0 ? <SemColuna /> : data ? data.split("-").reverse().join("/") : celulas[iData],
      historico: iHistorico < 0 ? <SemColuna /> : celulas[iHistorico],
      valor: valor === null ? <SemColuna /> : "valor" in valor ? formatarValor(valor.valor) : "—",
    };
  });

  return (
    <div className="importacao">
      <div>{cabecalho}</div>
      <div>
        <h1 ref={titulo} tabIndex={-1} className="importacao-titulo">
          De quais colunas o Ledgr precisa
        </h1>
        <p className="importacao-texto">
          O Ledgr precisa de três colunas: data, histórico e valor. Reconhecemos o que deu para
          reconhecer sozinhos. Confirme ou corrija abaixo.
        </p>
      </div>

      <div className="importacao-mapa">
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 600 }}>Colunas do arquivo</h3>
          {tabela.colunas.map((coluna, indice) => {
            const papel = mapa[indice];
            return (
              <div
                key={`${coluna}-${indice}`}
                className="mapa-coluna"
                data-pendente={papel === null ? "true" : undefined}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{coluna}</div>
                  <div style={{ fontSize: 13.5, color: cinza(62), overflowWrap: "anywhere" }}>
                    {tabela.linhas[0]?.[indice] ?? ""}
                  </div>
                </div>
                <div
                  className="pills"
                  role="group"
                  aria-label={`Papel da coluna ${coluna}`}
                  style={{ justifyContent: "flex-end" }}
                >
                  {PAPEIS.map((opcao) => (
                    <button
                      key={opcao.papel}
                      type="button"
                      className="pill"
                      aria-pressed={papel === opcao.papel}
                      onClick={() => definirPapel(indice, opcao.papel)}
                    >
                      {opcao.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {colunasDeValor === 2 && (
            <label className="mapa-opcao">
              <input
                type="checkbox"
                checked={inverterDebito}
                onChange={(evento) => setInverterDebito(evento.target.checked)}
              />
              <span>
                <strong>Débito negativo, crédito positivo</strong>
                <span style={{ display: "block", fontSize: 13.5, color: cinza(66) }}>
                  Inverter o sinal dos lançamentos de débito ao unir as duas colunas.
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="importacao-previa">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h3 id="como-o-ledgr-vai-ler" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              Como o Ledgr vai ler
            </h3>
            <span className={pronto ? "selo selo-ok" : "selo selo-atencao"}>
              {pronto ? "Pronto" : "Incompleto"}
            </span>
          </div>
          <table className="table" aria-labelledby="como-o-ledgr-vai-ler">
            <thead>
              <tr>
                <th>Data</th>
                <th>Histórico</th>
                <th style={{ textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {previa.map((linha, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{linha.data}</td>
                  <td>{linha.historico}</td>
                  <td className="dash-valor-celula">{linha.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
            {aviso && <p style={{ margin: 0, color: falta ? "var(--color-accent-700)" : undefined }}>{aviso}</p>}
            {resultado &&
              (resultado.lancamentos.length === 0 ? (
                <p style={{ margin: 0, color: "var(--color-accent-700)" }}>
                  Nenhuma linha dá para ler com esse mapeamento.
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  {formatarInteiro(resultado.lancamentos.length)}{" "}
                  {resultado.lancamentos.length === 1 ? "linha pronta" : "linhas prontas"} para conciliar.
                  {resultado.problemas.length > 0 &&
                    ` ${formatarInteiro(resultado.problemas.length)} ${
                      resultado.problemas.length === 1 ? "fica" : "ficam"
                    } de fora.`}
                </p>
              ))}
            {resultado && resultado.problemas.length > 0 && (
              <ul className="importacao-problemas">
                {resultado.problemas.slice(0, PROBLEMAS_LISTADOS).map((problema) => (
                  <li key={problema.linha}>{`Linha ${problema.linha}: ${problema.motivo}`}</li>
                ))}
                {resultado.problemas.length > PROBLEMAS_LISTADOS && (
                  <li>e mais {formatarInteiro(resultado.problemas.length - PROBLEMAS_LISTADOS)}.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="importacao-acoes">
        <button type="button" className="btn btn-primary" disabled={!pronto} onClick={confirmar}>
          Confirmar mapeamento
        </button>
        <button type="button" className="btn btn-secondary" onClick={onOutroArquivo}>
          Subir outro arquivo
        </button>
      </div>
    </div>
  );
}
