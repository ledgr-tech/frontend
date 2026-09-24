"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tom } from "@/lib/mock-data";
import type { ArquivoExtrato } from "../conciliacoes/acoes";
import { formatarDataHora, formatarInteiro } from "../dashboard/resumo";
import { IconeOrigem } from "../icone-origem";

/**
 * A galeria de "Extratos carregados" do design: cada arquivo é uma folha, e o
 * selecionado abre no painel ao lado. Fica no cliente só pelo filtro e pela
 * seleção — os dados chegam prontos da página, que roda no servidor.
 *
 * Do painel do design ficaram de fora caminho, tamanho, hash, "enviado por",
 * "Abrir o arquivo" e "Copiar caminho": o backend não guarda nada disso.
 */

type Filtro = "todos" | "banco" | "sistema" | "problema";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todos", rotulo: "Todos", vazio: "Nenhum arquivo." },
  { id: "banco", rotulo: "Do banco", vazio: "Nenhum arquivo do banco." },
  { id: "sistema", rotulo: "Do sistema", vazio: "Nenhum arquivo do sistema." },
  { id: "problema", rotulo: "Com problema", vazio: "Nenhum arquivo com problema." },
];

const ORIGEM = { banco: "Extrato do banco", sistema: "Extrato do sistema de gestão" };

/** Linhas da folha desenhada: a largura varia por arquivo, sem sortear a cada render. */
const LINHAS_DA_FOLHA = 9;

function temProblema(arquivo: ArquivoExtrato): boolean {
  return (
    arquivo.situacao === "erro" ||
    arquivo.situacao === "concluido_com_erros" ||
    arquivo.erros.length > 0
  );
}

function passaNoFiltro(arquivo: ArquivoExtrato, filtro: Filtro): boolean {
  if (filtro === "banco" || filtro === "sistema") return arquivo.origem === filtro;
  if (filtro === "problema") return temProblema(arquivo);
  return true;
}

function situacao(arquivo: ArquivoExtrato): { rotulo: string; tom: Tom } {
  switch (arquivo.situacao) {
    case "concluido":
      return { rotulo: "Conciliado", tom: "ok" };
    case "concluido_com_erros":
      return { rotulo: "Com linhas não lidas", tom: "atencao" };
    case "erro":
      return { rotulo: "Rejeitado", tom: "risco" };
    case "pendente":
    case "processando":
      return { rotulo: "Processando", tom: "neutro" };
    default:
      // o detalhe do arquivo não carregou: não inventa situação
      return { rotulo: "Sem detalhes", tom: "neutro" };
  }
}

function extensao(nome: string): string {
  const partes = nome.split(".");
  return partes.length > 1 ? partes[partes.length - 1].toUpperCase().slice(0, 4) : "ARQ";
}

function conteudo(arquivo: ArquivoExtrato): string {
  if (arquivo.lancamentos === null) return "Conteúdo indisponível";
  return `${formatarInteiro(arquivo.lancamentos)} ${arquivo.lancamentos === 1 ? "lançamento" : "lançamentos"}`;
}

function semente(id: string): number {
  let soma = 0;
  for (const letra of id) soma = (soma * 31 + letra.charCodeAt(0)) % 997;
  return soma;
}

function Folha({ arquivo }: { arquivo: ArquivoExtrato }) {
  const base = semente(arquivo.id);
  const problema = temProblema(arquivo);
  return (
    <span className="extrato-folha" data-origem={arquivo.origem} aria-hidden="true">
      <span className="extrato-folha-titulo">{ORIGEM[arquivo.origem]}</span>
      <span className="extrato-folha-linhas">
        {Array.from({ length: LINHAS_DA_FOLHA }, (_, i) => (
          <span
            key={i}
            className="extrato-folha-linha"
            // as linhas douradas marcam o arquivo que tem linha não lida, como no design
            data-marcada={problema && (i === 3 || i === 6) ? "true" : undefined}
          >
            <span style={{ maxWidth: `${34 + ((base + i * 13) % 44)}%` }} />
            <span />
          </span>
        ))}
      </span>
      <span className="extrato-etiqueta" data-problema={problema ? "true" : undefined}>
        {extensao(arquivo.nome)}
      </span>
    </span>
  );
}

export function Galeria({ arquivos }: { arquivos: ArquivoExtrato[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionado, setSelecionado] = useState<string | null>(arquivos[0]?.id ?? null);

  const visiveis = arquivos.filter((arquivo) => passaNoFiltro(arquivo, filtro));
  // se o filtro esconder o selecionado, o painel passa ao primeiro visível
  const aberto = visiveis.find((arquivo) => arquivo.id === selecionado) ?? visiveis[0] ?? null;

  return (
    <div className="extratos-corpo">
      <div className="pills" role="group" aria-label="Filtrar arquivos">
        {FILTROS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="pill"
            aria-pressed={filtro === item.id}
            onClick={() => setFiltro(item.id)}
          >
            {item.rotulo} ({arquivos.filter((arquivo) => passaNoFiltro(arquivo, item.id)).length})
          </button>
        ))}
      </div>

      {aberto === null ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <div className="extratos-area">
          <div className="extratos-grade">
            {visiveis.map((arquivo) => {
              const selo = situacao(arquivo);
              return (
                <button
                  key={arquivo.id}
                  type="button"
                  className="extrato-cartao"
                  aria-pressed={arquivo.id === aberto.id}
                  onClick={() => setSelecionado(arquivo.id)}
                >
                  <Folha arquivo={arquivo} />
                  <span className="extrato-nome">
                    <IconeOrigem origem={arquivo.origem} tamanho={15} />
                    {arquivo.nome}
                  </span>
                  <span className="extrato-meta">{conteudo(arquivo)}</span>
                  <span className={selo.tom === "neutro" ? "selo" : `selo selo-${selo.tom}`}>
                    {selo.rotulo}
                  </span>
                </button>
              );
            })}
          </div>
          <Painel arquivo={aberto} />
        </div>
      )}
    </div>
  );
}

function Painel({ arquivo }: { arquivo: ArquivoExtrato }) {
  const selo = situacao(arquivo);
  const naoLidas = arquivo.erros.length;
  return (
    <section className="extrato-painel" aria-label="Arquivo selecionado">
      <h6 style={{ margin: 0 }}>Arquivo · {selo.rotulo.toLowerCase()}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{arquivo.nome}</h3>
        <IconeOrigem origem={arquivo.origem} tamanho={22} />
      </div>

      <dl className="extrato-campos">
        <div>
          <dt>Origem</dt>
          <dd>{ORIGEM[arquivo.origem]}</dd>
        </div>
        <div>
          <dt>Conteúdo</dt>
          <dd>{conteudo(arquivo)}</dd>
        </div>
        <div>
          <dt>Última conciliação</dt>
          <dd>{formatarDataHora(arquivo.conciliadoEm)}</dd>
        </div>
        <div>
          <dt>Identificador</dt>
          <dd style={{ wordBreak: "break-all" }}>{arquivo.id}</dd>
        </div>
      </dl>

      {naoLidas > 0 && (
        <div className="extrato-nao-lidas">
          <h4>
            {formatarInteiro(naoLidas)} {naoLidas === 1 ? "linha não lida" : "linhas não lidas"}
          </h4>
          <ul>
            {arquivo.erros.map((erro) => (
              <li key={`${erro.identificador}-${erro.motivo}`}>
                <span className="extrato-nao-lida-onde">{erro.identificador}</span>
                <span>{erro.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href={arquivo.resultado} className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
        Ver conciliação
      </Link>
    </section>
  );
}
