import { useId } from "react";
import { formatarInteiro } from "../../../dashboard/resumo";
import type { ErroDeCampo } from "./acoes";

export function ErrosImportacaoIa({ erro, erros, totalErros }: { erro: string; erros: ErroDeCampo[]; totalErros: number }) {
  const titulo = useId();
  return (
    <section className="ia-erros" aria-labelledby={titulo} role="alert">
      <div className="ia-erros-topo">
        <span className="selo selo-risco">{`${formatarInteiro(totalErros)} ${totalErros === 1 ? "erro" : "erros"}`}</span>
        <h2 id={titulo} className="font-titulo">
          {erro}
        </h2>
      </div>
      <p>Corrija os pontos abaixo no arquivo, ou peça à IA para refazer a resposta, e envie de novo.</p>
      {totalErros > erros.length && (
        <p>{`Aparecem os ${formatarInteiro(erros.length)} primeiros de ${formatarInteiro(totalErros)}. Ao enviar de novo, os que restarem aparecem aqui.`}</p>
      )}
      <div className="ia-rolavel">
        <table className="table" aria-label="Erros do arquivo">
          <thead>
            <tr>
              <th scope="col">Lançamento</th>
              <th scope="col">Campo</th>
              <th scope="col">O que corrigir</th>
            </tr>
          </thead>
          <tbody>
            {erros.map((e, i) => (
              <tr key={i}>
                <td>{e.lancamento ?? "—"}</td>
                <td>
                  <code>{e.caminho || "arquivo"}</code>
                </td>
                <td>{e.mensagem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
