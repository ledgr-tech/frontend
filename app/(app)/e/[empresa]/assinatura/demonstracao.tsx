"use client";

import { Reveal } from "@/app/reveal";
import { PLANOS } from "@/lib/planos";
import { CancelarAssinatura } from "./cancelar-assinatura";
import { ASSINATURA, FATURAS, NUMEROS } from "./dados";
import { Cabecalho } from "../cabecalho";

/**
 * A assinatura de demonstração: o plano, os planos da landing e as faturas. Tudo
 * mock (ver `dados.ts`), e nada aqui finge que mudou: toda ação que mexeria na
 * cobrança aparece desligada e aponta para o aviso que diz por quê. Aparece sem a
 * situação no `GET /me` (backend antigo) e para o piloto ativado à mão, sem
 * assinatura na Stripe; o resto vê `PainelDaAssinatura`.
 *
 * ponytail: cancelar, trocar de plano ou de cartão e as faturas esperam o PR 2 do
 * backend #166; aí esta tela vira a leitura da cobrança real.
 */

const AVISO_ID = "assinatura-aviso";

export function AssinaturaDeDemonstracao() {
  const { plano, renovaEm, faixa } = ASSINATURA;

  return (
    <div>
      <Cabecalho
        titulo="Assinatura"
        // sem contexto o cabeçalho também perdia a empresa, que toda tela mostra
        contexto={[`plano ${plano.nome}`, `renova em ${renovaEm}`]}
        acoes={
          <>
            <button type="button" className="btn btn-secondary" disabled aria-describedby={AVISO_ID}>
              Trocar forma de pagamento
            </button>
            <CancelarAssinatura fimDoPeriodo={renovaEm} />
          </>
        }
      />

      <div className="ass-corpo">
        <p id={AVISO_ID} role="note" className="aviso-demonstracao">
          <strong>A cobrança ainda não está no ar.</strong> Plano e faturas desta tela são de
          demonstração, e nada é alterado por aqui.
        </p>

        <Reveal className="grade-colunas dash-resumo">
          {NUMEROS.map((numero) => (
            <div key={numero.rotulo}>
              <span className="dash-rotulo">{numero.rotulo}</span>
              <span className="dash-valor">{numero.valor}</span>
              <span className="dash-nota">{numero.nota}</span>
            </div>
          ))}
        </Reveal>

        <Reveal delay={0.08}>
          <section className="ass-planos-caixa">
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
                    {/* sem preço da Stripe, nenhum valor, nem de demonstração (#296) */}
                    {opcao.contato && (
                      <div className="ass-plano-valor">
                        <span className="ass-plano-preco">Sob consulta</span>
                      </div>
                    )}
                    <span className="ass-plano-filete" aria-hidden="true" />
                    {opcao.descricao && <p className="ass-plano-texto">{opcao.descricao}</p>}
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
        </Reveal>

        <Reveal delay={0.16}>
          <section className="ass-faturas">
            <h3 className="ass-titulo">Faturas</h3>
            <div className="dash-tabela-rolagem">
              <table className="table">
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th style={{ width: 170 }}>Vencimento</th>
                    <th style={{ width: 130, textAlign: "right" }}>Situação</th>
                    <th style={{ width: 110, textAlign: "right" }}>Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {FATURAS.map((fatura) => (
                    <tr key={fatura.competencia}>
                      <td style={{ fontSize: 15 }}>{fatura.competencia}</td>
                      <td className="dash-celula-fraca">{fatura.vencimento}</td>
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
        </Reveal>
      </div>
    </div>
  );
}
