/** Quantos caracteres do fim ficam sempre à vista: é ali que os arquivos se diferenciam (mês, versão, extensão). */
const FIM_VISIVEL = 14;

/**
 * O nome de um arquivo numa linha só, cortado no meio: o começo encolhe com reticências e o fim fica.
 * "Extrato_Conta_Corrente_Banco…revisado) v12.csv" em vez de "Extrato_Conta_Corrente_Banco_do_Brasil_A…".
 * O nome inteiro vai no `title` e, inteiro e numa peça só, para o leitor de tela: as duas partes à vista
 * são itens de um flex, que ele leria como dois blocos.
 */
export function NomeDoArquivo({ nome, prefixo = "" }: { nome: string; prefixo?: string }) {
  if (nome.length <= FIM_VISIVEL * 2) {
    return (
      <span className="hist-arquivo-nome" title={nome}>
        {prefixo + nome}
      </span>
    );
  }
  return (
    <span className="hist-arquivo-nome" title={nome}>
      <span className="hist-arquivo-inicio" aria-hidden="true">
        {prefixo + nome.slice(0, -FIM_VISIVEL)}
      </span>
      <span className="hist-arquivo-fim" aria-hidden="true">
        {nome.slice(-FIM_VISIVEL)}
      </span>
      <span className="sr-only">{prefixo + nome}</span>
    </span>
  );
}
