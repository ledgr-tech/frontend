/** Quantos caracteres do fim ficam sempre à vista: é ali que os arquivos se diferenciam (mês, versão, extensão). */
const FIM_VISIVEL = 14;

/**
 * O nome de um arquivo numa linha só, cortado no meio: o começo encolhe com reticências e o fim fica.
 * "Extrato_Conta_Corrente_Banco…revisado) v12.csv" em vez de "Extrato_Conta_Corrente_Banco_do_Brasil_A…".
 * O nome inteiro vai no `title`.
 */
export function NomeDoArquivo({ nome, prefixo = "" }: { nome: string; prefixo?: string }) {
  const corta = nome.length > FIM_VISIVEL * 2;
  const fim = corta ? nome.slice(-FIM_VISIVEL) : "";
  return (
    <span className="hist-arquivo-nome" title={nome}>
      <span className="hist-arquivo-inicio">{prefixo + (corta ? nome.slice(0, -FIM_VISIVEL) : nome)}</span>
      {fim && <span className="hist-arquivo-fim">{fim}</span>}
    </span>
  );
}
