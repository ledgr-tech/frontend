import { LogoBarras } from "@/app/(app)/logo-barras";
import { Reveal } from "../reveal";

// "Por que o Ledgr": as duas saídas que a empresa tem hoje e o Ledgr, cada uma respondendo às
// mesmas perguntas, na ordem de ASPECTOS. Por tipo de solução, sem nome de concorrente: a página
// não tem como sustentar o que cada produto faz ou deixa de fazer.
const ASPECTOS = ["Trocar de sistema", "Quem confere, todo mês", "Para começar", "O que custa"];

// cada resposta é [o que responde à pergunta, o resto da frase]: o primeiro trecho vai em negrito,
// e lendo só os negritos de uma linha dá para comparar as três saídas
type Resposta = [destaque: string, resto?: string];

type Saida = { nome: string; respostas: Resposta[] };

const SAIDAS_DE_HOJE: Saida[] = [
  {
    nome: "Conferir à mão",
    respostas: [
      ["Não precisa."],
      ["Alguém que entenda de contabilidade", ", linha por linha, com as duas telas abertas."],
      ["A planilha de sempre."],
      ["As horas de quem confere", ", em todo fechamento."],
    ],
  },
  {
    nome: "Migrar para um sistema com conciliação",
    respostas: [
      ["Precisa.", " A empresa inteira passa para o sistema novo."],
      ["O sistema novo", ", depois que tudo estiver nele."],
      ["Migrar cadastros, contas e histórico", ", e treinar a equipe."],
      ["A mensalidade do sistema novo", ", mais o trabalho da migração."],
    ],
  },
];

const SAIDA_LEDGR: Saida = {
  nome: "Ledgr",
  respostas: [
    ["Não precisa.", " Funciona com o sistema que você já usa."],
    ["O Ledgr, linha por linha", ": você revisa só o que não bate, já com o motivo."],
    ["Subir dois arquivos", ": o extrato do banco e o do sistema."],
    ["Pelo volume de lançamentos do mês", ", sem fidelidade nem taxa de implantação."],
  ],
};

const SAIDAS = [...SAIDAS_DE_HOJE, SAIDA_LEDGR];

/**
 * A comparação com as saídas de hoje, depois de "Por dentro": o produto já foi explicado e a
 * pessoa está comparando, e a última pergunta ("O que custa") prepara a Assinatura. Uma tabela de
 * verdade, com a pergunta uma vez só; os `role` mantêm a tabela para o leitor de tela quando, no
 * celular, ela vira um bloco por pergunta (globals.css), como as tabelas do app.
 */
export function PorQueOLedgr() {
  return (
    <>
      <Reveal className="por-que-abertura">
        <p className="rotulo-parte rotulo-parte-ledgr">Por que o Ledgr</p>
        <h2 className="titulo-misto" style={{ margin: 0, fontSize: "clamp(30px, 2.8vw, 46px)" }}>
          Sem trocar de sistema, <em>e sem voltar para o manual.</em>
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <table className="por-que-tabela" role="table">
          <caption className="sr-only">As saídas de hoje e o Ledgr, pergunta por pergunta</caption>
          <colgroup className="por-que-col-pergunta" />
          <colgroup span={2} />
          <colgroup className="por-que-col-ledgr" />
          <thead role="rowgroup">
            <tr role="row" className="por-que-grupos">
              <td aria-hidden="true" />
              {/* o rótulo num span: o filete dele é flex, e um th flex deixa de ser célula */}
              <th role="columnheader" scope="colgroup" colSpan={2}>
                <span className="rotulo-parte">Hoje</span>
              </th>
              <th role="columnheader" scope="colgroup">
                <span className="rotulo-parte rotulo-parte-ledgr">Com o Ledgr</span>
              </th>
            </tr>
            <tr role="row" className="por-que-nomes">
              <td aria-hidden="true" />
              {SAIDAS.map((saida) => (
                <th
                  key={saida.nome}
                  role="columnheader"
                  scope="col"
                  className={saida === SAIDA_LEDGR ? "por-que-ledgr" : undefined}
                >
                  {saida === SAIDA_LEDGR && <LogoBarras className="por-que-logo" />}
                  {saida.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {ASPECTOS.map((aspecto, i) => (
              <tr key={aspecto} role="row">
                <th role="rowheader" scope="row">
                  {aspecto}
                </th>
                {SAIDAS.map((saida) => (
                  <td
                    key={saida.nome}
                    role="cell"
                    data-rotulo={saida.nome}
                    className={saida === SAIDA_LEDGR ? "por-que-ledgr" : undefined}
                  >
                    <strong>{saida.respostas[i][0]}</strong>
                    {saida.respostas[i][1]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </>
  );
}
