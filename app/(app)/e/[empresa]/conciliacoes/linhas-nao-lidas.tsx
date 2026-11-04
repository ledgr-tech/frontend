import type { SituacaoExtrato } from "./acoes";

const LISTADAS = 5;

/**
 * O extrato que o backend leu em parte (`concluido_com_erros`): quantas linhas ficaram de fora e as
 * primeiras delas. Aparece nas duas telas que param para a pessoa decidir se concilia sem elas: a
 * nova conciliação e a nova versão do extrato do sistema.
 */
export function LinhasNaoLidas({ origem, erros }: Pick<SituacaoExtrato, "origem" | "erros">) {
  const resto = erros.length - LISTADAS;
  return (
    <div className="linhas-nao-lidas">
      <p role="alert" className="selo selo-risco nova-versao-erro">
        {erros.length === 0
          ? `Algumas linhas do extrato do ${origem} não foram lidas.`
          : erros.length === 1
            ? `1 linha do extrato do ${origem} não foi lida.`
            : `${erros.length} linhas do extrato do ${origem} não foram lidas.`}
      </p>
      {erros.length > 0 && (
        <ul className="importacao-problemas">
          {erros.slice(0, LISTADAS).map((linha, indice) => (
            <li key={`${linha.identificador}-${indice}`}>{`Linha ${linha.identificador}: ${linha.motivo}`}</li>
          ))}
          {resto > 0 && <li>{`e mais ${resto} ${resto === 1 ? "linha não lida" : "linhas não lidas"}.`}</li>}
        </ul>
      )}
    </div>
  );
}
