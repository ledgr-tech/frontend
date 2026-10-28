"use client";

import { useEffect, useRef, useState } from "react";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import { criarLinkDoRelatorio, listarLinksDoRelatorio, revogarLinkDoRelatorio, type LinkDoRelatorio } from "./links";

type Estado = { situacao: "carregando" } | { situacao: "sem-rota" } | { situacao: "pronto"; links: LinkDoRelatorio[] };

const VALIDADES = [7, 30, 90];
const MAXIMO_ATIVOS = 5;

const dia = (iso: string) => formatarDataHora(iso).slice(0, 10);

/**
 * "Link para o cliente" no passo do relatório (#229, opção B do 28/10): o cliente do escritório abre o
 * relatório no navegador, sem conta. Escolhe-se a validade (7, 30 ou 90 dias; o backend aceita de 1 a 90) e
 * gera-se o link. O endereço completo só existe na criação (o backend guarda o hash do token), então fica em
 * destaque até ser copiado; depois, a tabela mostra só o prefixo, a validade e os acessos. Só para quem fecha
 * o mês, e some se o backend ainda não tem a rota (ou a flag está desligada).
 */
export function LinkPublico({ competencia }: { competencia: string }) {
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });
  const [validade, setValidade] = useState(30);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const trava = useRef(false);

  useEffect(() => {
    let vivo = true;
    listarLinksDoRelatorio(competencia)
      .then((r) => vivo && setEstado(r.ok ? { situacao: "pronto", links: r.dados } : { situacao: "sem-rota" }))
      .catch(() => vivo && setEstado({ situacao: "sem-rota" }));
    return () => {
      vivo = false;
    };
  }, [competencia]);

  if (estado.situacao !== "pronto") return null;
  const ativos = estado.links.filter((link) => link.ativo);
  const noLimite = ativos.length >= MAXIMO_ATIVOS;

  /** Uma chamada por vez: a trava fecha antes do primeiro await. */
  async function executar(trabalho: () => Promise<string | null>) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      const falha = await trabalho();
      if (falha) setErro(falha);
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  const gerar = () =>
    executar(async () => {
      const r = await criarLinkDoRelatorio(competencia, validade, window.location.origin);
      if (!r.ok) {
        // 404 na criação: a flag do backend está desligada, a ação ainda não existe
        if (r.status === 404) setEstado({ situacao: "sem-rota" });
        return r.status === 404 ? null : r.erro;
      }
      setEndereco(r.dados.endereco);
      setCopiado(false);
      setEstado((atual) => (atual.situacao === "pronto" ? { situacao: "pronto", links: [r.dados.link, ...atual.links] } : atual));
      return null;
    });

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o endereço e copie à mão.");
    }
  }

  const revogar = (id: string) =>
    executar(async () => {
      const r = await revogarLinkDoRelatorio(competencia, id);
      if (!r.ok) return r.erro;
      setConfirmando(null);
      setEndereco(null);
      setEstado((atual) =>
        atual.situacao === "pronto"
          ? { situacao: "pronto", links: atual.links.map((link) => (link.id === id ? { ...link, ativo: false } : link)) }
          : atual,
      );
      return null;
    });

  return (
    <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 12, marginTop: 8 }} role="group" aria-labelledby={`link-${competencia}`}>
      <div>
        <strong id={`link-${competencia}`}>Link para o cliente</strong>
        <div className="fech-passo-texto">O cliente abre o relatório no navegador, sem conta. Você revoga quando quiser.</div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="fech-passo-texto">Validade</span>
        <div className="pills segmentado" role="group" aria-label="Validade do link">
          {VALIDADES.map((dias) => (
            <button key={dias} type="button" className="pill" aria-pressed={validade === dias} onClick={() => setValidade(dias)}>
              {`${dias} dias`}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-secondary" onClick={gerar} disabled={ocupado || noLimite}>
          Gerar link
        </button>
        {noLimite && <span className="fech-passo-texto">{`O limite é de ${MAXIMO_ATIVOS} links ativos: revogue um para gerar outro.`}</span>}
      </div>

      {endereco && (
        <div role="status" style={{ display: "grid", gap: 6, padding: 12, borderRadius: 10, background: "color-mix(in srgb, var(--color-accent) 10%, transparent)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" readOnly value={endereco} aria-label="Link público do relatório" style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-primary" onClick={copiar}>
              {copiado ? "Link copiado" : "Copiar link"}
            </button>
          </div>
          <span className="fech-passo-texto">Este endereço não aparece de novo: copie agora.</span>
        </div>
      )}

      {ativos.length > 0 && (
        <table className="table" aria-label="Links ativos">
          <thead>
            <tr>
              <th scope="col">Link</th>
              <th scope="col">Válido até</th>
              <th scope="col" className="rel-num">
                Acessos
              </th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ativos.map((link) => (
              <tr key={link.id}>
                <td>
                  {`${link.prefixo}…`}
                  <div style={{ fontSize: 12.5, opacity: 0.65 }}>
                    {link.ultimoAcessoEm ? `último acesso em ${dia(link.ultimoAcessoEm)}` : `criado por ${link.criadoPor}`}
                  </div>
                </td>
                <td>{dia(link.expiraEm)}</td>
                <td className="rel-num">{link.acessos}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {confirmando === link.id ? (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => revogar(link.id)} disabled={ocupado}>
                        Confirmar revogação
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setConfirmando(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-ghost" aria-label={`Revogar o link ${link.prefixo}`} onClick={() => setConfirmando(link.id)}>
                      Revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {erro && <MensagemErro id={`erro-link-${competencia}`}>{erro}</MensagemErro>}
    </div>
  );
}
