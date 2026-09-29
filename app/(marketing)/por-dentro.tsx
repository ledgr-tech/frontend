import type { ReactNode } from "react";
import { Reveal } from "@/app/reveal";
import type { LinhaExtrato } from "./comparacao";
import { Vitrine } from "./vitrine";

/**
 * "Por dentro do Ledgr": a vida de uma linha, a #1082 da demonstração de "O
 * problema", dos dois extratos até o seu sistema de gestão, em quatro etapas
 * curtas. Logo abaixo, a tela inteira do app numa janela (`Vitrine`), com a
 * mesma linha em destaque: o fluxo conta, a tela mostra.
 *
 * Termina no sistema de gestão, e não numa decisão dentro do Ledgr, porque o app
 * ainda não grava decisão nenhuma (aceitar o valor do banco, fechar o mês).
 */

function Etapa({ num, titulo, atraso, children }: { num: string; titulo: string; atraso: number; children: ReactNode }) {
  return (
    <li className="por-dentro-etapa">
      <Reveal delay={atraso} className="por-dentro-etapa-corpo">
        {/* o numeral e o fio em onda que liga uma etapa à outra, no desenho das bordas da landing */}
        <span className="por-dentro-cabeca" aria-hidden="true">
          <span className="por-dentro-num">{num}</span>
          <span className="por-dentro-fio" />
        </span>
        <h3 className="por-dentro-titulo">{titulo}</h3>
        <p className="por-dentro-texto">{children}</p>
      </Reveal>
    </li>
  );
}

export function PorDentro({ banco, sistema }: { banco: LinhaExtrato[]; sistema: LinhaExtrato[] }) {
  return (
    <>
      <ol className="por-dentro-trilha">
        <Etapa num="I" titulo="Duas versões da mesma linha" atraso={0}>
          O pagamento ao fornecedor chega nos dois arquivos, no mesmo dia, com 36 reais de diferença.
        </Etapa>
        <Etapa num="II" titulo="O Ledgr acha a diferença" atraso={0.08}>
          O Ledgr junta as duas pela data e mede a diferença. A linha entra em “Valor diverge na mesma data”, com
          outras 40 do mesmo tipo em agosto.
        </Etapa>
        <Etapa num="III" titulo="E diz o motivo" atraso={0.16}>
          Cada divergência vem com o motivo mais provável, e o que corrigir fica por sua conta.
        </Etapa>
        <Etapa num="IV" titulo="Você corrige no seu sistema" atraso={0.24}>
          Como o banco é a referência, os 36 reais são ajustados no seu sistema de gestão. A linha também
          sai no relatório em CSV que vai para o contador.
        </Etapa>
      </ol>
      <Reveal>
        <Vitrine banco={banco} sistema={sistema} destaque="Pagamento fornecedor #1082" />
      </Reveal>
    </>
  );
}
