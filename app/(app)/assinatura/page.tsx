import { PLANOS } from "@/lib/planos";
import { CancelarAssinatura } from "./cancelar-assinatura";
import { ASSINATURA, FATURAS, NUMEROS } from "./dados";

/**
 * A assinatura da empresa: o plano, os planos da landing e as faturas. Tudo
 * mock (ver `dados.ts`), e nada aqui finge que mudou: toda ação que mexeria na
 * cobrança aparece desligada e aponta para o aviso que diz por quê. Com o dado
 * fixo e sem backend, a tela sai pronta do servidor e dispensa esqueleto.
 */

const AVISO_ID = "assinatura-aviso";

export default function AssinaturaPage() {
  const { plano, renovaEm, faixa } = ASSINATURA;

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Assinatura</h1>
          <span className="vg-subtitulo">{`Plano ${plano.nome} · renova em ${renovaEm}`}</span>
        </div>
        <div className="ass-acoes">
          <button type="button" className="btn btn-secondary" disabled aria-describedby={AVISO_ID}>
            Trocar forma de pagamento
          </button>
          <CancelarAssinatura fimDoPeriodo={renovaEm} />
        </div>
      </div>

      <div className="ass-corpo">
        <p id={AVISO_ID} role="note" className="ass-aviso">
          <strong>A cobrança ainda não está no ar.</strong> Plano e faturas desta tela são de
          demonstração, e nada é alterado por aqui.
        </p>

        <div className="grade-colunas dash-resumo">
          {NUMEROS.map((numero) => (
            <div key={numero.rotulo}>
              <span className="dash-rotulo">{numero.rotulo}</span>
              <span className="dash-valor">{numero.valor}</span>
              <span className="dash-nota">{numero.nota}</span>
            </div>
          ))}
        </div>

        <section>
          <h3 id="assinatura-planos" className="ass-titulo">
            Planos
          </h3>
          <ul className="ass-planos" aria-labelledby="assinatura-planos">
            {PLANOS.map((opcao) => {
              const atual = opcao.nome === plano.nome;
              return (
                <li key={opcao.nome} className="ass-plano" data-atual={atual ? "true" : undefined}>
                  <div className="ass-plano-topo">
                    <h4 className="ass-plano-nome">{opcao.nome}</h4>
                    {atual && <span className="ass-plano-atual">Atual</span>}
                  </div>
                  <div className="ass-plano-valor">
                    <span className="ass-plano-preco">{opcao.preco}</span>
                    {!opcao.contato && <span className="ass-plano-sufixo">/mês</span>}
                  </div>
                  <span className="ass-plano-filete" aria-hidden="true" />
                  <p className="ass-plano-texto">{opcao.limite}</p>
                  {atual && <p className="ass-plano-texto">{faixa}</p>}
                  {/* o plano atual não é ação, é estado; os outros seriam troca de plano */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled
                    aria-describedby={atual ? undefined : AVISO_ID}
                  >
                    {atual ? "Plano atual" : `Mudar para ${opcao.nome}`}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ass-faturas">
          <h3 className="ass-titulo">Faturas</h3>
          <div className="dash-tabela-rolagem">
            <table className="table">
              <thead>
                <tr>
                  <th>Competência</th>
                  <th style={{ width: 170 }}>Vencimento</th>
                  <th style={{ width: 140, textAlign: "right" }}>Valor</th>
                  <th style={{ width: 130, textAlign: "right" }}>Situação</th>
                  <th style={{ width: 110, textAlign: "right" }}>Recibo</th>
                </tr>
              </thead>
              <tbody>
                {FATURAS.map((fatura) => (
                  <tr key={fatura.competencia}>
                    <td style={{ fontSize: 15 }}>{fatura.competencia}</td>
                    <td className="dash-celula-fraca">{fatura.vencimento}</td>
                    <td className="ass-fatura-valor">{fatura.valor}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={fatura.situacao === "Paga" ? "selo selo-ok" : "selo"}>
                        {fatura.situacao}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {/* fatura a vencer ainda não tem recibo */}
                      {fatura.situacao === "Paga" ? (
                        <button
                          type="button"
                          className="ass-recibo"
                          disabled
                          aria-label={`Recibo de ${fatura.competencia.toLowerCase()} em PDF`}
                          aria-describedby={AVISO_ID}
                        >
                          PDF
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
