/**
 * O roteiro de primeiros passos da Visão geral (spec 2026-10-15-primeiro-uso, parte 4). Cada passo
 * se marca pelo que já existe na conta. "Escolher o plano" está sempre feito: quem chega à Visão
 * geral sem plano é levado antes para /plano. A faixa só o mostra quando o `GET /me` manda a
 * situação da conta; sem ela não há teste para dizer que começou.
 */
export type DadosDoRoteiro = {
  /** A tolerância já foi salva alguma vez (`atualizado_em` de `/empresa/configuracoes`). */
  toleranciaRevisada: boolean;
  temExtratoDoBanco: boolean;
  conciliou: boolean;
  /** Alguma conciliação sem nada pedindo decisão. */
  resolveuAlguma: boolean;
  fechouAlgum: boolean;
  /** O endereço da conciliação com mais pendências, para o passo das divergências. */
  conciliacaoComPendencia: string | null;
};

type Destino = { tipo: "link"; href: string } | { tipo: "configuracoes" } | null;

export type PassoDoRoteiro = {
  id: "plano" | "tolerancia" | "banco" | "conciliar" | "divergencias" | "fechar";
  titulo: string;
  texto: string;
  feito: boolean;
  destino: Destino;
};

export function passosDoRoteiro(d: DadosDoRoteiro): PassoDoRoteiro[] {
  return [
    { id: "plano", titulo: "Escolher o plano", texto: "O teste de 14 dias começou.", feito: true, destino: null },
    { id: "tolerancia", titulo: "Definir a tolerância de dias", texto: "Quantos dias de diferença ainda contam como bateu.", feito: d.toleranciaRevisada, destino: { tipo: "configuracoes" } },
    { id: "banco", titulo: "Enviar o extrato do banco", texto: "OFX ou CSV do internet banking.", feito: d.temExtratoDoBanco || d.conciliou, destino: { tipo: "link", href: "/conciliacoes/nova" } },
    { id: "conciliar", titulo: "Enviar o extrato do sistema e conciliar", texto: "O CSV exportado do seu sistema de gestão.", feito: d.conciliou, destino: { tipo: "link", href: "/conciliacoes/nova" } },
    { id: "divergencias", titulo: "Resolver as divergências", texto: "Conferir ou justificar o que não bateu.", feito: d.resolveuAlguma, destino: d.conciliacaoComPendencia ? { tipo: "link", href: d.conciliacaoComPendencia } : null },
    { id: "fechar", titulo: "Fechar o mês", texto: "Com o relatório em PDF para o cliente.", feito: d.fechouAlgum, destino: { tipo: "link", href: "/fechamentos" } },
  ];
}

export function roteiroVisivel(d: DadosDoRoteiro): boolean {
  return !d.fechouAlgum;
}
