import { ConteudoCartao } from "@/app/(app)/conciliacoes/[id]/cartao-lancamento";
import { estaResolvida, rotuloCurto, seloDoStatus } from "@/app/(app)/dashboard/resumo";
import { IconeOrigem } from "@/app/(app)/icone-origem";
import type { LinhaExtrato } from "./comparacao";

/** A interação da demonstração de "O problema"; sem ela, a tabela é só desenho. */
export type InteracaoFolhas = {
  /** a descrição da linha com o cartão aberto */
  aberta: string | null;
  idCartao: string;
  /** o cartão abre sem a subida: o ponteiro veio direto de outra linha */
  naHora: boolean;
  abrir: (desc: string) => void;
  fechar: (desc: string) => void;
};

function Coluna({
  folha,
  direita,
  centro,
  setas,
  children,
}: {
  folha?: "banco" | "sistema";
  direita?: boolean;
  centro?: boolean;
  setas: boolean;
  children: string;
}) {
  return (
    <th
      className={[folha && `folha-${folha}`, direita && "th-direita", centro && "th-centro"].filter(Boolean).join(" ") || undefined}
      style={direita ? { textAlign: "right" } : undefined}
    >
      {setas ? (
        <span className="th-ordena">
          {children}
          <span className="th-ordena-seta">↕</span>
        </span>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * A tabela da Comparação direta do app, em duas folhas, com as linhas de agosto da landing. Desenha a
 * demonstração de "O problema", que abre o cartão do hover como o app, e a tela do app na janela de
 * "Por dentro", parada, com uma linha acesa e o cartão dela aberto. As duas mostram a mesma tabela.
 *
 * As classes e os campos são os do app (app/(app)/conciliacoes/[id]/page.tsx), inclusive os
 * `role` e o `data-rotulo` que viram cartão no celular: o status no eixo entre as duas folhas, em
 * nome curto, o que bateu sem selo, e o campo que diverge marcado dos dois lados. O par é casado
 * pela descrição, e a data de cada lado vem do extrato dele.
 */
export function TabelaFolhas({
  banco,
  sistema,
  setas = false,
  destacada,
  interacao,
}: {
  banco: LinhaExtrato[];
  sistema: LinhaExtrato[];
  /** as setas de ordenar do cabeçalho: só na réplica, que não se clica */
  setas?: boolean;
  /** a linha acesa da réplica, com o cartão aberto */
  destacada?: string;
  interacao?: InteracaoFolhas;
}) {
  return (
    <table className="table tabela-folhas folhas-com-eixo" role="table">
      {/* as larguras do app (globals.css): as folhas saem iguais dos dois lados do eixo */}
      <colgroup>
        <col className="col-data" />
        <col />
        <col className="col-valor" />
        <col className="col-eixo" />
        <col className="col-data" />
        <col />
        <col className="col-valor" />
      </colgroup>
      <thead role="rowgroup">
        <tr role="row" className="folhas-titulos">
          <th colSpan={3} scope="colgroup" className="folha-banco folha-titulo">
            <span className="folha-titulo-conteudo">
              <IconeOrigem origem="banco" />
              <span className="folha-nome">Extrato do banco</span>
              <span className="folha-etiqueta">Fonte da verdade</span>
            </span>
          </th>
          <td className="folha-fora" aria-hidden="true" />
          <th colSpan={3} scope="colgroup" className="folha-sistema folha-titulo">
            <span className="folha-titulo-conteudo">
              <IconeOrigem origem="sistema" />
              <span className="folha-nome">Sistema de gestão</span>
            </span>
          </th>
        </tr>
        <tr role="row">
          <Coluna folha="banco" setas={setas}>
            Data
          </Coluna>
          <Coluna folha="banco" setas={setas}>
            Descrição
          </Coluna>
          <Coluna folha="banco" direita setas={setas}>
            Banco
          </Coluna>
          <Coluna centro setas={setas}>
            Status
          </Coluna>
          {/* como no app: a data e a descrição que ordenam são as do banco */}
          <Coluna folha="sistema" setas={false}>
            Data
          </Coluna>
          <Coluna folha="sistema" setas={false}>
            Descrição
          </Coluna>
          <Coluna folha="sistema" direita setas={setas}>
            Sistema
          </Coluna>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {banco.map((b) => {
          const s = sistema.find((linha) => linha.desc === b.desc);
          const selo = seloDoStatus(b.status);
          // o cartão só nas linhas que pedem revisão, como no app: nas batidas seria ruído
          const revisar = !estaResolvida(b.status);
          const comCartao = interacao && revisar ? interacao : null;
          const aberta = comCartao?.aberta === b.desc;
          const abrir = () => comCartao?.abrir(b.desc);
          const fechar = () => comCartao?.fechar(b.desc);
          // a divergência pinta o campo em questão dos dois lados, numa marca que acende com o
          // ponteiro na linha, como no app
          const diverge = (campo: "valor" | "data") => (b.status === `divergente_${campo}` ? "true" : undefined);
          const marcar = (campo: "valor" | "data", texto: string) =>
            diverge(campo) ? <span className="marca-diverge">{texto}</span> : texto;

          return (
            // o tom do status pinta o hover: a linha acende na cor do veredito dela
            <tr
              key={b.desc}
              role="row"
              data-tom={selo.tom}
              data-destacada={b.desc === destacada || undefined}
              data-aberta={aberta || undefined}
              onMouseEnter={comCartao ? abrir : undefined}
              onMouseLeave={comCartao ? fechar : undefined}
            >
              <td role="cell" data-rotulo="Data" data-diverge={diverge("data")} className="dash-celula-fraca folha-banco">
                {marcar("data", b.data)}
              </td>
              <td role="cell" data-rotulo="Descrição" data-destaque="true" className="folha-banco celula-descricao">
                {comCartao ? (
                  // botão de verdade, como no app: foco e toque abrem o cartão, que não tem hover
                  <button
                    type="button"
                    className="celula-abrir"
                    aria-describedby={aberta ? comCartao.idCartao : undefined}
                    onClick={abrir}
                    onFocus={abrir}
                    onBlur={fechar}
                    onKeyDown={(evento) => evento.key === "Escape" && fechar()}
                  >
                    {b.desc}
                  </button>
                ) : (
                  b.desc
                )}
              </td>
              <td role="cell" data-rotulo="Banco" data-diverge={diverge("valor")} className="dash-valor-celula folha-banco">
                {b.valorBanco ? marcar("valor", b.valorBanco) : "—"}
              </td>
              {/* o nome curto cabe no eixo; o inteiro fica para o leitor de tela. O que bateu vai
                  sem selo: só o que pede revisão ganha cor */}
              <td role="cell" data-rotulo="Status" className="celula-status">
                <span className={revisar ? `selo selo-${selo.tom}` : "status-batido"} aria-hidden="true">
                  {rotuloCurto(b)}
                </span>
                <span className="sr-only">{selo.rotulo}</span>
                {/* o cartão sai do selo, como no app, com a seta apontando para ele (globals.css) */}
                {(aberta || b.desc === destacada) && (
                  <div
                    id={aberta ? comCartao?.idCartao : undefined}
                    role={aberta ? "tooltip" : undefined}
                    className="cartao-lancamento cartao-no-eixo"
                    data-lado="acima"
                    data-na-hora={(aberta && comCartao?.naHora) || undefined}
                  >
                    <ConteudoCartao
                      rotulo={selo.rotulo}
                      titulo={b.desc}
                      banco={b.valorBanco ? `${b.data} · ${b.valorBanco}` : "—"}
                      sistema={s?.valorSistema ? `${s.data} · ${s.valorSistema}` : "—"}
                      explicacao={b.explicacao}
                      // as explicações da demonstração são as da IA, ligada no lançamento: vêm
                      // com o selo, como no produto
                      geradaPorIa
                    />
                  </div>
                )}
              </td>
              {s ? (
                <>
                  <td role="cell" data-rotulo="Data no sistema" data-diverge={diverge("data")} className="dash-celula-fraca folha-sistema">
                    {marcar("data", s.data)}
                  </td>
                  <td role="cell" data-rotulo="Descrição no sistema" className="folha-sistema celula-descricao">
                    {s.desc}
                  </td>
                  <td role="cell" data-rotulo="Sistema" data-diverge={diverge("valor")} className="dash-valor-celula folha-sistema">
                    {s.valorSistema ? marcar("valor", s.valorSistema) : "—"}
                  </td>
                </>
              ) : (
                // uma célula só no lugar de três traços, como no app: a folha diz que falta
                <td role="cell" colSpan={3} data-rotulo="Sistema" className="folha-sistema folha-vazia">
                  <span className="folha-vazia-marca">sem lançamento no sistema</span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
