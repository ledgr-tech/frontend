/** Situação comercial de uma conta no painel interno (backend #176): rótulos, cor do selo e o prazo do teste. */

export const SITUACOES = ["sem_plano", "teste", "teste_encerrado", "ativo", "inativa"] as const;

export const POR_PAGINA = 20;

export const ROTULO_DA_SITUACAO: Record<string, string> = {
  sem_plano: "Sem plano",
  teste: "Em teste",
  teste_encerrado: "Teste encerrado",
  ativo: "Ativa",
  inativa: "Inativa",
};

/** A chave do filtro e do rótulo: uma conta inativa vale "inativa" qualquer que seja a situação comercial. */
export function chaveDaSituacao(conta: { situacao: string; inativa: boolean }): string {
  return conta.inativa ? "inativa" : conta.situacao;
}

/** A classe do selo: verde para ativa, âmbar para em teste, vermelho para o que pede atenção, neutro para sem plano. */
export function classeDoSelo(chave: string): string {
  if (chave === "ativo") return "selo selo-ok";
  if (chave === "teste") return "selo selo-atencao";
  if (chave === "teste_encerrado" || chave === "inativa") return "selo selo-risco";
  return "selo";
}

/** "em 5 dias", "há 8 dias", "hoje": quanto falta ou faz desde o fim do teste. `agora` entra de fora para o teste fixar a data. */
export function prazoDoTeste(iso: string, agora: number): string {
  const dias = Math.round((Date.parse(iso) - agora) / 86_400_000);
  if (dias === 0) return "hoje";
  const n = Math.abs(dias);
  const texto = `${n} ${n === 1 ? "dia" : "dias"}`;
  return dias > 0 ? `em ${texto}` : `há ${texto}`;
}

/** O instante da requisição, para o prazo do teste; fora do componente porque a leitura do relógio não é pura. */
export function agoraEmMs(): number {
  return Date.now();
}
