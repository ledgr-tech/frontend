import { formatarMoeda } from "@/lib/mock-data";
import { formatarDataHora, formatarInteiro } from "../dashboard/resumo";
import type { LinhaDoRelatorio, ParDoRelatorio, RelatorioDoFechamento } from "./relatorio";

/** A folha do relatório do fechamento: a da página do app (#117) e a do link público (#229). */
export function Folha({ relatorio }: { relatorio: RelatorioDoFechamento }) {
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
