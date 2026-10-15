import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatarMoeda } from "@/lib/mock-data";
import { carregarRelatorioDoFechamento } from "../../../conciliacoes/acoes";
import { formatarDataHora, formatarInteiro } from "../../../dashboard/resumo";
import { tituloDaCompetencia } from "../../fechamento";
import { montarRelatorio, type LinhaDoRelatorio, type ParDoRelatorio, type RelatorioDoFechamento } from "../../relatorio";
import { Imprimir } from "./imprimir";

/**
 * O relatório do fechamento do mês (#117): a página que o contador imprime ou salva em PDF, o
 * "Relatório em PDF" do "Entregar o fechamento" do design (Ledgr.dc.html). Na tela, uma prévia da
 * folha com o botão de imprimir; na impressão, só a folha, em A4 (`.rel-*` em globals.css).
 */

const FALHA_AO_CARREGAR = "Não foi possível carregar o relatório. Recarregue a página e tente de novo.";

export default async function RelatorioPage({ params, searchParams }: PageProps<"/fechamentos/[competencia]/relatorio">) {
  const { competencia } = await params;
  const { imprimir } = await searchParams;
  const resposta = await carregarRelatorioDoFechamento(competencia);
  if (!resposta.ok && resposta.status === 401) redirect("/login");
  if (!resposta.ok && resposta.status === 404) notFound();

  const voltar = `/fechamentos?mes=${competencia}`;
  const dados = resposta.ok ? resposta.dados : null;

  return (
    <div className="rel-pagina">
      <div className="rel-barra">
        <Link href={voltar} className="btn btn-ghost">
          <ArrowLeft size={16} aria-hidden />
          Fechamentos
        </Link>
        {dados?.fechamento && <Imprimir automatico={imprimir === "1"} />}
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : !resposta.dados.fechamento ? (
        <div className="rel-aviso">
          <h1>{`${tituloDaCompetencia(competencia)} ainda não está fechado.`}</h1>
          <p>O relatório fica pronto quando o mês é fechado. Feche o mês na tela de Fechamentos e volte aqui.</p>
          <Link href={voltar} className="btn btn-primary">
            Ir para Fechamentos
          </Link>
        </div>
      ) : (
        <Folha relatorio={montarRelatorio(resposta.dados)} />
      )}
    </div>
  );
}

function Folha({ relatorio }: { relatorio: RelatorioDoFechamento }) {
  return (
    <article className="rel-folha">
      <header className="rel-topo">
        <div>
          <div className="det-kicker">Relatório do fechamento</div>
          <h1>{relatorio.titulo}</h1>
          {relatorio.empresa && <p className="rel-empresa">{relatorio.empresa}</p>}
          {relatorio.cnpj && <p className="rel-cnpj">{`CNPJ ${relatorio.cnpj}`}</p>}
        </div>
        <div className="rel-situacao">
          <span className={`selo ${relatorio.ressalva ? "selo-atencao" : "selo-ok"}`}>{relatorio.situacao}</span>
          <p>{`Fechado em ${formatarDataHora(relatorio.fechadoEm)} por ${relatorio.fechadoPor}.`}</p>
        </div>
      </header>

      <section aria-labelledby="rel-resumo" className="rel-secao">
        <h2 id="rel-resumo">Resumo do mês</h2>
        <dl className="rel-numeros">
          <Numero rotulo="Lançamentos" valor={formatarInteiro(relatorio.total)} />
          <Numero rotulo="Conciliados" valor={formatarInteiro(relatorio.conciliadas)} />
          <Numero rotulo="Justificados" valor={formatarInteiro(relatorio.justificadas)} />
          <Numero rotulo="Pendentes" valor={formatarInteiro(relatorio.pendentes)} />
          <Numero rotulo="Linhas não lidas" valor={formatarInteiro(relatorio.linhasNaoLidas)} />
          <Numero rotulo="Valor em aberto" valor={formatarMoeda(relatorio.valorEmAberto)} />
        </dl>
        <table className="table rel-tabela rel-categorias" aria-label="Divergências por categoria">
          <thead>
            <tr>
              <th scope="col">Divergência</th>
              <th scope="col" className="rel-num">
                Linhas
              </th>
            </tr>
          </thead>
          <tbody>
            {relatorio.categorias.map((categoria) => (
              <tr key={categoria.status}>
                <td>{categoria.rotulo}</td>
                <td className="rel-num">{formatarInteiro(categoria.quantidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rel-nota">
          Números gravados no fechamento: não mudam se o mês for reaberto depois.
        </p>
      </section>

      {relatorio.ressalva && (
        <section aria-labelledby="rel-ressalva" className="rel-secao">
          <h2 id="rel-ressalva">Ressalva</h2>
          <blockquote className="fech-ressalva">
            <span>{relatorio.ressalva}</span>
          </blockquote>
        </section>
      )}

      {relatorio.pares.map((par) => (
        <Par key={`${par.arquivoBanco}-${par.arquivoSistema}`} par={par} />
      ))}

      <footer className="rel-rodape">{`Gerado pelo Ledgr em ${formatarDataHora(new Date().toISOString())}.`}</footer>
    </article>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

function valor(numero: number | null): string {
  return numero === null ? "—" : formatarMoeda(numero);
}

function Par({ par }: { par: ParDoRelatorio }) {
  return (
    <section className="rel-secao rel-par">
      <h2>{`${par.arquivoBanco} × ${par.arquivoSistema}`}</h2>
      <p className="rel-nota">{`Extrato do banco × extrato do sistema · rodada ${par.rodada}`}</p>
      {par.justificadas === null || par.pendentes === null ? (
        <p role="alert" className="rel-nota">
          Não foi possível carregar as linhas deste par. Recarregue a página antes de imprimir.
        </p>
      ) : (
        <>
          {par.truncada && (
            <p role="alert" className="rel-nota">
              O par tem mais linhas do que o Ledgr consegue ler de uma vez: a lista abaixo está incompleta.
            </p>
          )}
          <h3>Justificadas</h3>
          {par.justificadas.length === 0 ? (
            <p className="rel-nota">Nenhuma linha justificada.</p>
          ) : (
            <TabelaDeLinhas rotulo="Linhas justificadas" linhas={par.justificadas} comJustificativa />
          )}
          {par.pendentes.length > 0 && (
            <>
              <h3>Pendentes</h3>
              <TabelaDeLinhas rotulo="Linhas pendentes" linhas={par.pendentes} />
            </>
          )}
        </>
      )}
    </section>
  );
}

function TabelaDeLinhas({
  rotulo,
  linhas,
  comJustificativa = false,
}: {
  rotulo: string;
  linhas: LinhaDoRelatorio[];
  comJustificativa?: boolean;
}) {
  return (
    <table className="table rel-tabela" aria-label={rotulo}>
      <thead>
        <tr>
          <th scope="col">Data</th>
          <th scope="col">Descrição</th>
          <th scope="col" className="rel-num">
            Banco
          </th>
          <th scope="col" className="rel-num">
            Sistema
          </th>
          <th scope="col">{comJustificativa ? "Justificativa" : "Situação"}</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, indice) => (
          <tr key={indice}>
            <td className="rel-data">{linha.data}</td>
            <td>{linha.descricao}</td>
            <td className="rel-num">{valor(linha.valorBanco)}</td>
            <td className="rel-num">{valor(linha.valorSistema)}</td>
            <td>
              {comJustificativa ? (
                <>
                  <span>{linha.justificativa}</span>
                  {linha.decididoPor && (
                    <span className="rel-quem">
                      {`${linha.decididoPor}${linha.decididoEm ? ` · ${formatarDataHora(linha.decididoEm).slice(0, 10)}` : ""}`}
                    </span>
                  )}
                </>
              ) : (
                linha.status
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
