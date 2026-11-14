"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BotaoFecharJanela, ModalDaTela } from "../../../(app)/e/[empresa]/empresas/modal-da-tela";
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
    <p role="alert" className="adm-folga-10">
      {texto}
    </p>
  ) : null;
}

function CampoDoMotivo({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  return (
    <label className="adm-campo">
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
              <p className="adm-folga-baixo">{`Desfaz o cancelamento agendado: a assinatura renova${fim ? ` em ${fim}` : ""} e a cobrança segue normal.`}</p>
            ) : (
              <fieldset className="adm-grupo">
                <legend className="adm-folga-baixo-8">Quando cancelar</legend>
                <label className="adm-linha-base">
                  <input type="radio" name="quando" checked={quando === "fim_do_periodo"} onChange={() => setQuando("fim_do_periodo")} />
                  <span>
                    <strong>No fim do período</strong>
                    <br />
                    <span className="adm-texto-apagado">{`O cliente usa${fim ? ` até ${fim}` : " até o fim do período pago"} e não é cobrado de novo. Dá para desfazer até lá.`}</span>
                  </span>
                </label>
                <label className="adm-linha-base">
                  <input type="radio" name="quando" checked={quando === "agora"} onChange={() => setQuando("agora")} />
                  <span>
                    <strong>Agora</strong>
                    <br />
                    <span className="adm-texto-apagado">O acesso pago acaba já, sem devolver o que falta do período. Não dá para desfazer.</span>
                  </span>
                </label>
                <p className="adm-nota">Reembolso não sai daqui: devolva pelo painel da Stripe, se for o caso.</p>
              </fieldset>
            )}
            <CampoDoMotivo valor={motivo} mudar={setMotivo} />
            <Erro texto={erro} />
            <div className="adm-botoes">
              <BotaoFecharJanela aoFechar={fechar} className="btn btn-ghost">
                Voltar
              </BotaoFecharJanela>
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
            <div className="adm-pilha">
              <p role="status" className="adm-sem-margem">
                <strong>{`${dado.cupom} (${dado.desconto})`}</strong>
                {dado.forma === "assinatura" ? " entrou direto na assinatura: a próxima fatura já sai com o desconto." : " virou um código de uso único."}
              </p>
              {dado.codigo && (
                <div className="adm-linha">
                  <code className="adm-codigo">{dado.codigo}</code>
                  <button type="button" className="btn btn-ghost" onClick={() => copiar(dado.codigo!)}>
                    {copiado ? "Copiado" : "Copiar código"}
                  </button>
                </div>
              )}
              {dado.expiraEm && <p className="adm-texto">{`Vale até ${formatarDataHora(dado.expiraEm).slice(0, 10)}.`}</p>}
              <p className="adm-texto">
                {dado.emailEnviado ? "O admin da conta recebeu um e-mail com o desconto." : "O e-mail não saiu: mande o código ao cliente por fora."}
              </p>
              <div className="adm-botoes-direita">
                <button type="button" className="btn btn-primary" onClick={fechar}>
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={confirmar} className="adm-pilha">
              <p className="adm-sem-margem">
                {assinaturaViva
                  ? "A conta tem assinatura: o desconto entra direto nela, sem código."
                  : "A conta não tem assinatura: o cupom vira um código de uso único para o checkout, mandado ao admin da conta por e-mail."}
              </p>
              {cupons === null && !erro ? (
                <p className="adm-sem-margem">Carregando os cupons da Stripe…</p>
              ) : cupons && cupons.length === 0 ? (
                <p className="adm-sem-margem">Nenhum cupom válido na Stripe. Crie um no painel da Stripe (Catálogo de produtos › Cupons).</p>
              ) : cupons ? (
                <label className="adm-campo">
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
                <label className="adm-campo adm-campo-estreito">
                  Validade do código (dias)
                  <input className="input" type="number" min={1} max={90} value={validade} onChange={(e) => setValidade(Number(e.target.value))} required />
                </label>
              )}
              <Erro texto={erro} />
              <div className="adm-botoes-direita">
                <BotaoFecharJanela aoFechar={fechar} className="btn btn-ghost">
                  Cancelar
                </BotaoFecharJanela>
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
