/**
 * O endereço de uma conciliação na tela.
 *
 * O resultado parte do extrato do banco, mas é o par que identifica uma
 * conciliação: o mesmo extrato do banco pode ter sido conciliado com mais de um
 * arquivo do sistema, e sem o do sistema o backend devolve as linhas de todos
 * os pares misturadas. Por isso ele viaja na URL, em `?sistema=`.
 */
export function caminhoDaConciliacao(
  extratoBancoId: string,
  extratoSistemaId?: string,
  linhaId?: string,
): string {
  const linha = linhaId ? `/${linhaId}` : "";
  const par = extratoSistemaId ? `?sistema=${encodeURIComponent(extratoSistemaId)}` : "";
  return `/conciliacoes/${extratoBancoId}${linha}${par}`;
}

/**
 * O CSV da conciliação, pela rota do servidor que chama o backend com o token
 * (`app/api/conciliacoes/[id]/exportar`). O par e a categoria escolhida no
 * relatório vão juntos, para o arquivo ter as mesmas linhas que a tela.
 */
export function caminhoDoCsv(extratoBancoId: string, extratoSistemaId?: string, status?: string): string {
  const busca = new URLSearchParams();
  if (extratoSistemaId) busca.set("sistema", extratoSistemaId);
  if (status) busca.set("status", status);
  const query = busca.toString();
  return `/api/conciliacoes/${extratoBancoId}/exportar${query ? `?${query}` : ""}`;
}
