import type { ReactNode } from "react";
import { Reveal } from "@/app/reveal";
import type { LinhaExtrato } from "./comparacao";
import { FioDaTrilha } from "./fio-da-trilha";
import { Vitrine } from "./vitrine";

/**
 * "Por dentro do Ledgr": a vida de uma linha, a #1082 da demonstração de "O
 * problema", dos dois extratos até o seu sistema de gestão, em quatro etapas
 * numa trilha vertical. Um fio em onda desce entre os numerais conforme a página
 * rola (`FioDaTrilha`) e termina na tela inteira do app numa janela (`Vitrine`),
 * com a mesma linha em destaque: cada etapa, e por último a janela, aparece
 * quando a ponta do fio chega nela. O fluxo conta, a tela mostra.
 *
 * Termina no sistema de gestão, e não numa decisão dentro do Ledgr, porque o app
 * ainda não grava decisão nenhuma (aceitar o valor do banco, fechar o mês).
 */

// Altura da tela, em % a partir do topo, em que a ponta do fio desenha. As etapas e a janela se
// revelam quando o topo delas passa dessa mesma altura, então aparecem junto com o fio.
const PONTA_DO_FIO = 60;
const NA_PONTA_DO_FIO = { amount: 0, margin: `0px 0px -${100 - PONTA_DO_FIO}% 0px` };

function Etapa({ num, titulo, children }: { num: string; titulo: string; children: ReactNode }) {
  return (
    <li className="por-dentro-etapa">
      <Reveal viewport={NA_PONTA_DO_FIO} className="por-dentro-etapa-corpo">
        <span className="por-dentro-num" aria-hidden="true">
          {num}
        </span>
        <h3 className="por-dentro-titulo">{titulo}</h3>
        <p className="por-dentro-texto">{children}</p>
      </Reveal>
    </li>
  );
}

/** `children` é o título da seção, que fica parado ao lado dos passos no desktop. */
export function PorDentro({
  banco,
  sistema,
  children,
}: {
  banco: LinhaExtrato[];
  sistema: LinhaExtrato[];
  children: ReactNode;
}) {
  return (
    <>
      {/* título e passos num bloco só, sem a janela: o sticky anda dentro do pai, então o título
          para quando os passos acabam, em vez de descer por cima da tela do app */}
      <div className="por-dentro-passagem">
        <Reveal className="por-dentro-topo">{children}</Reveal>
        <div className="por-dentro-percurso">
          <FioDaTrilha ponta={PONTA_DO_FIO} />
          <ol className="por-dentro-trilha">
            <Etapa num="I" titulo="Duas versões da mesma linha">
              O pagamento ao fornecedor chega nos dois arquivos, no mesmo dia, com 36 reais de diferença.
            </Etapa>
            <Etapa num="II" titulo="O Ledgr acha a diferença">
              O Ledgr junta as duas pela data e mede a diferença. A linha entra em “Valor diverge na mesma data”, com
              outras 40 do mesmo tipo em agosto.
            </Etapa>
            <Etapa num="III" titulo="E diz o motivo">
              Cada divergência vem com o motivo mais provável, e o que corrigir fica por sua conta.
            </Etapa>
            <Etapa num="IV" titulo="Você corrige no seu sistema">
              Como o banco é a referência, os 36 reais são ajustados no seu sistema de gestão. A linha também
              sai no relatório em CSV que vai para o contador.
            </Etapa>
          </ol>
        </div>
      </div>
      <Reveal viewport={NA_PONTA_DO_FIO} className="por-dentro-janela">
        <Vitrine banco={banco} sistema={sistema} destaque="Pagamento fornecedor #1082" />
      </Reveal>
    </>
  );
}
