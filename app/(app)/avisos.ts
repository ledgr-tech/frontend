import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { Tom } from "@/lib/mock-data";
import type { VisaoGeral } from "./conciliacoes/acoes";
import { estaResolvida, formatarDataHora, formatarMoedaCurta, valorEmAberto } from "./dashboard/resumo";
import { pendencias } from "./visao-geral/pendencias";

export type Aviso = {
  /** Estável para o mesmo fato: é por ele que o "já li" é lembrado. */
  id: string;
  titulo: string;
  texto: string;
  quando: string;
  tom: Tom;
  href: string;
};

function plural(quantidade: number, um: string, varios: string): string {
  return `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? um : varios}`;
}

/**
 * Os avisos saem da conciliação mais recente, como a visão geral: o que ainda
 * pede decisão e os arquivos com linhas que o parser não leu. Nada de aviso
 * inventado; sem conciliação, não há aviso.
 *
 * ponytail: o backend não tem notificações. Quando tiver (extrato novo no banco,
 * prazo do contador), elas entram aqui ao lado destas.
 */
export function avisosDoMes(visao: VisaoGeral): Aviso[] {
  if (!visao.recente) return [];
  const { execucao, conciliacao } = visao.recente;
  const quando = `Conciliação de ${formatarDataHora(execucao.executadaEm)}`;
  const avisos: Aviso[] = [];

  const emAberto = conciliacao.linhas.filter((linha) => !estaResolvida(linha.status));
  if (emAberto.length > 0) {
    const maisComum = [...pendencias(conciliacao)].sort((a, b) => b.quantidade - a.quantidade)[0];
    const valor = valorEmAberto(emAberto);
    avisos.push({
      id: `divergencias-${execucao.id}`,
      titulo: plural(emAberto.length, "divergência aguardando decisão", "divergências aguardando decisão"),
      texto:
        valor > 0
          ? `${formatarMoedaCurta(valor)} em aberto, a maior parte em “${maisComum.rotulo}”.`
          : `A maior parte em “${maisComum.rotulo}”.`,
      quando,
      tom: "risco",
      href: caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId),
    });
  }

  for (const arquivo of visao.arquivosComLinhasNaoLidas) {
    avisos.push({
      id: `nao-lidas-${execucao.id}-${arquivo.nome}`,
      titulo: `${plural(arquivo.linhas, "linha não lida", "linhas não lidas")} em ${arquivo.nome}`,
      texto: "Ficaram fora da conciliação. Confira o arquivo antes de fechar o mês.",
      quando,
      tom: "atencao",
      href: "/extratos",
    });
  }

  return avisos;
}

const LIDOS = "ledgr_avisos_lidos";

/** Os ids já lidos neste navegador. Guardado vazio, estragado ou sem acesso: nenhum. */
export function idsLidos(): string[] {
  try {
    const guardado: unknown = JSON.parse(window.localStorage.getItem(LIDOS) ?? "[]");
    return Array.isArray(guardado) ? guardado.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Guarda só os avisos que existem agora: o id de uma conciliação refeita não
 * volta, então a lista não cresce para sempre.
 */
export function marcarLidos(ids: string[]): void {
  try {
    window.localStorage.setItem(LIDOS, JSON.stringify(ids));
  } catch {
    // aba anônima ou armazenamento bloqueado: o aviso só volta a contar como novo
  }
}
