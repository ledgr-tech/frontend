"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ModalDaTela } from "../../../(app)/e/[empresa]/empresas/modal-da-tela";
import { formatarDataHora } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { cancelarAssinatura, darCupom, listarCupons, manterAssinatura, type CupomDado, type CupomDaStripe } from "../acoes";

/** Uma chamada por vez (a trava é um `ref`, antes do primeiro `await`), com o erro e o "enviando" da janela. */
function useEnvio() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const trava = useRef(false);
  async function enviar(chamada: () => Promise<{ ok: true } | { ok: false; erro: string }>): Promise<boolean> {
    if (trava.current) return false;
    trava.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const r = await chamada();
      if (!r.ok) setErro(r.erro);
      return r.ok;
    } catch {
      setErro("Não foi possível falar com o servidor.");
      return false;
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }
  return { erro, setErro, enviando, enviar };
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? (
    <p role="alert" style={{ margin: "10px 0 0" }}>
      {texto}
    </p>
  ) : null;
}

function CampoDoMotivo({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 13.5 }}>
      Motivo (fica só no Ledgr, no histórico da conta)
      <textarea className="input" value={valor} onChange={(e) => mudar(e.target.value)} maxLength={500} required rows={3} />
    </label>
  );
}

/**
 * Cancelar ou manter a assinatura da conta (#236, backend #182). Cancelar escolhe entre o fim do período
 * (o cliente usa até lá) e agora; nenhum dos dois devolve dinheiro, o reembolso é no painel da Stripe.
 * Com o cancelamento agendado, a ação é "Manter assinatura", que desfaz.
 */
export function AcoesDaAssinatura({ id, nome, agendado, fimDoPeriodo }: { id: string; nome: string; agendado: boolean; fimDoPeriodo: string | null }) {
  const roteador = useRouter();
  const [aberta, setAberta] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [quando, setQuando] = useState<"fim_do_periodo" | "agora">("fim_do_periodo");
  const { erro, setErro, enviando, enviar } = useEnvio();

  function fechar() {
    setAberta(false);
    setMotivo("");
    setQuando("fim_do_periodo");
    setErro(null);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    const ok = await enviar(() => (agendado ? manterAssinatura(id, motivo) : cancelarAssinatura(id, quando, motivo)));
    if (!ok) return;
    fechar();
    roteador.refresh();
  }

  const fim = fimDoPeriodo ? formatarDataHora(fimDoPeriodo).slice(0, 10) : null;
  const botao = agendado ? "Manter assinatura" : "Cancelar assinatura";

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setAberta(true)}>
        {agendado ? "Manter assinatura…" : "Cancelar assinatura…"}
      </button>
      {aberta && (
        <ModalDaTela titulo={agendado ? `Manter a assinatura de ${nome}?` : `Cancelar a assinatura de ${nome}?`} aoFechar={fechar}>
          <form onSubmit={confirmar}>
            {agendado ? (
              <p style={{ margin: "0 0 12px" }}>{`Desfaz o cancelamento agendado: a assinatura renova${fim ? ` em ${fim}` : ""} e a cobrança segue normal.`}</p>
            ) : (
              <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px", display: "grid", gap: 8 }}>
                <legend style={{ marginBottom: 8 }}>Quando cancelar</legend>
                <label style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <input type="radio" name="quando" checked={quando === "fim_do_periodo"} onChange={() => setQuando("fim_do_periodo")} />
                  <span>
                    <strong>No fim do período</strong>
                    <br />
                    <span style={{ fontSize: 13.5, opacity: 0.75 }}>{`O cliente usa${fim ? ` até ${fim}` : " até o fim do período pago"} e não é cobrado de novo. Dá para desfazer até lá.`}</span>
                  </span>
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <input type="radio" name="quando" checked={quando === "agora"} onChange={() => setQuando("agora")} />
                  <span>
                    <strong>Agora</strong>
                    <br />
                    <span style={{ fontSize: 13.5, opacity: 0.75 }}>O acesso pago acaba já, sem devolver o que falta do período. Não dá para desfazer.</span>
                  </span>
                </label>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>Reembolso não sai daqui: devolva pelo painel da Stripe, se for o caso.</p>
              </fieldset>
            )}
            <CampoDoMotivo valor={motivo} mudar={setMotivo} />
            <Erro texto={erro} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={fechar}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary" disabled={enviando || !motivo.trim()}>
                {enviando ? "Enviando…" : botao}
              </button>
            </div>
          </form>
        </ModalDaTela>
      )}
    </>
  );
}

/**
 * Dar um cupom da Stripe à conta (#236). Sem assinatura viva vira um código de uso único com validade,
 * mandado por e-mail ao admin da conta; com assinatura viva, o desconto entra direto nela. O resultado
 * mostra o código para copiar, porque o e-mail pode não ter saído.
 */
export function DarCupom({ id, nome, assinaturaViva }: { id: string; nome: string; assinaturaViva: boolean }) {
  const roteador = useRouter();
  const [aberta, setAberta] = useState(false);
  const [cupons, setCupons] = useState<CupomDaStripe[] | null>(null);
  const [cupomId, setCupomId] = useState("");
  const [validade, setValidade] = useState(30);
  const [dado, setDado] = useState<CupomDado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { erro, setErro, enviando, enviar } = useEnvio();

  async function abrir() {
    setAberta(true);
    setCupons(null);
    setErro(null);
    const r = await listarCupons().catch(() => ({ ok: false as const, erro: "Não foi possível falar com o servidor." }));
    if (!r.ok) return setErro(r.erro);
    setCupons(r.dados);
    setCupomId(r.dados[0]?.id ?? "");
  }

  function fechar() {
    setAberta(false);
    setCupomId("");
    setValidade(30);
    setErro(null);
    setCopiado(false);
    // o histórico de cupons da conta só muda depois de um dado
    if (dado) roteador.refresh();
    setDado(null);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    await enviar(async () => {
      const r = await darCupom(id, cupomId, validade);
      if (r.ok) setDado(r.dados);
      return r;
    });
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={abrir}>
        Dar cupom…
      </button>
      {aberta && (
        <ModalDaTela titulo={`Dar um cupom a ${nome}`} aoFechar={fechar}>
          {dado ? (
            <div style={{ display: "grid", gap: 10 }}>
              <p role="status" style={{ margin: 0 }}>
                <strong>{`${dado.cupom} (${dado.desconto})`}</strong>
                {dado.forma === "assinatura" ? " entrou direto na assinatura: a próxima fatura já sai com o desconto." : " virou um código de uso único."}
              </p>
              {dado.codigo && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{ fontSize: 18, padding: "6px 10px", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-sm)" }}>{dado.codigo}</code>
                  <button type="button" className="btn btn-ghost" onClick={() => copiar(dado.codigo!)}>
                    {copiado ? "Copiado" : "Copiar código"}
                  </button>
                </div>
              )}
              {dado.expiraEm && <p style={{ margin: 0, fontSize: 13.5 }}>{`Vale até ${formatarDataHora(dado.expiraEm).slice(0, 10)}.`}</p>}
              <p style={{ margin: 0, fontSize: 13.5 }}>
                {dado.emailEnviado ? "O admin da conta recebeu um e-mail com o desconto." : "O e-mail não saiu: mande o código ao cliente por fora."}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-primary" onClick={fechar}>
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={confirmar} style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0 }}>
                {assinaturaViva
                  ? "A conta tem assinatura: o desconto entra direto nela, sem código."
                  : "A conta não tem assinatura: o cupom vira um código de uso único para o checkout, mandado ao admin da conta por e-mail."}
              </p>
              {cupons === null && !erro ? (
                <p style={{ margin: 0 }}>Carregando os cupons da Stripe…</p>
              ) : cupons && cupons.length === 0 ? (
                <p style={{ margin: 0 }}>Nenhum cupom válido na Stripe. Crie um no painel da Stripe (Catálogo de produtos › Cupons).</p>
              ) : cupons ? (
                <label style={{ display: "grid", gap: 4, fontSize: 13.5 }}>
                  Cupom
                  <select className="input" value={cupomId} onChange={(e) => setCupomId(e.target.value)} required>
                    {cupons.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.nome} · ${c.resumo}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {!assinaturaViva && (
                <label style={{ display: "grid", gap: 4, fontSize: 13.5, maxWidth: 220 }}>
                  Validade do código (dias)
                  <input className="input" type="number" min={1} max={90} value={validade} onChange={(e) => setValidade(Number(e.target.value))} required />
                </label>
              )}
              <Erro texto={erro} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={fechar}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviando || !cupomId}>
                  {enviando ? "Enviando…" : "Dar cupom"}
                </button>
              </div>
            </form>
          )}
        </ModalDaTela>
      )}
    </>
  );
}
