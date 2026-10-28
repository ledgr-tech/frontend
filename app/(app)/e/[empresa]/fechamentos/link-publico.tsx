"use client";

import { useEffect, useState } from "react";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import { criarLinkDoRelatorio, listarLinksDoRelatorio, revogarLinkDoRelatorio, type LinkDoRelatorio } from "./links";

type Estado = { situacao: "carregando" } | { situacao: "sem-rota" } | { situacao: "pronto"; links: LinkDoRelatorio[] };

/**
 * "Link público" ao lado do "Baixar PDF" (#229): o cliente do escritório abre o relatório no navegador,
 * sem conta. O endereço completo só existe na hora da criação (o backend guarda o hash do token), então
 * ele fica nesta tela até ser copiado; depois, só o prefixo identifica o link. Só para quem fecha o mês.
 */
export function LinkPublico({ competencia }: { competencia: string }) {
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });
  const [endereco, setEndereco] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  async function gerar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await criarLinkDoRelatorio(competencia, 30, window.location.origin);
      if (!r.ok) {
        // 404 na criação: a flag do backend está desligada, a ação não existe ainda
        if (r.status === 404) setEstado({ situacao: "sem-rota" });
        else setErro(r.erro);
        return;
      }
      setEndereco(r.dados.endereco);
      setCopiado(false);
      setEstado((atual) => (atual.situacao === "pronto" ? { situacao: "pronto", links: [r.dados.link, ...atual.links] } : atual));
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o endereço e copie à mão.");
    }
  }

  async function revogar(id: string) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await revogarLinkDoRelatorio(competencia, id);
      if (!r.ok) return setErro(r.erro);
      setConfirmando(null);
      setEndereco(null);
      setEstado((atual) =>
        atual.situacao === "pronto"
          ? { situacao: "pronto", links: atual.links.map((link) => (link.id === id ? { ...link, ativo: false } : link)) }
          : atual,
      );
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fech-link-publico">
      <div className="fech-relatorio">
        <span className="fech-passo-texto">
          Um link para o cliente abrir o relatório no navegador, sem conta. Vale 30 dias e você revoga quando quiser.
        </span>
        <button type="button" className="btn btn-secondary" onClick={gerar} disabled={ocupado || ativos.length >= 5}>
          Gerar link
        </button>
      </div>
      {endereco && (
        <div className="fech-relatorio" role="status">
          <input className="input" readOnly value={endereco} aria-label="Link público do relatório" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-secondary" onClick={copiar}>
            {copiado ? "Link copiado" : "Copiar link"}
          </button>
          <span className="fech-passo-texto">Este endereço não aparece de novo: copie agora.</span>
        </div>
      )}
      {ativos.map((link) => (
        <div key={link.id} className="fech-relatorio">
          <span className="fech-passo-texto">
            {`Link ${link.prefixo}… · válido até ${formatarDataHora(link.expiraEm).slice(0, 10)} · ${link.acessos} ${link.acessos === 1 ? "acesso" : "acessos"}`}
          </span>
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
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmando(link.id)}>
              Revogar
            </button>
          )}
        </div>
      ))}
      {erro && <MensagemErro id={`erro-link-${competencia}`}>{erro}</MensagemErro>}
    </div>
  );
}
