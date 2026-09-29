import Image from "next/image";
import type { ReactNode } from "react";
import { FileDown } from "lucide-react";
import { seloDoStatus } from "@/app/(app)/dashboard/resumo";
import { Reveal } from "@/app/reveal";

/**
 * "Por dentro do Ledgr": a vida de uma linha, a #1082 da demonstração de "O
 * problema", dos dois extratos até o seu sistema de gestão. Cada etapa traz um
 * recorte no desenho do cartão daquela demonstração: cabeçalho, linhas com
 * divisória e o selo com contorno dourado. São vitrine (`inert`): quem descreve
 * a etapa é o texto.
 *
 * Termina no sistema de gestão, e não numa decisão dentro do Ledgr, porque o app
 * ainda não grava decisão nenhuma (aceitar o valor do banco, fechar o mês).
 */

const SELO = seloDoStatus("divergente_valor");

// O que a tela da linha mostra hoje para um valor que diverge: com a IA
// desligada, é o motivo fixo do motor (`_MOTIVOS_DETERMINISTICOS` em
// app/services/ia/prompt.py, no backend), sem o selo de IA.
const MOTIVO_VALOR = "Existe um lançamento do outro lado na mesma data, mas o valor não coincide com o deste item.";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="por-dentro-recorte-linha">
      <span className="por-dentro-rotulo">{rotulo}</span>
      <span className="por-dentro-valor">{valor}</span>
    </div>
  );
}

function Etapa({
  num,
  titulo,
  atraso,
  topo,
  meta,
  recorte,
  children,
}: {
  num: string;
  titulo: string;
  atraso: number;
  /** o cabeçalho do recorte, como o "Extrato do banco · extrato-08.ofx" da demonstração */
  topo: string;
  meta?: string;
  recorte: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="por-dentro-etapa">
      <Reveal once delay={atraso} className="por-dentro-etapa-corpo">
        {/* o numeral e o fio em onda que liga uma etapa à outra, no desenho das bordas da landing */}
        <span className="por-dentro-cabeca" aria-hidden="true">
          <span className="por-dentro-num">{num}</span>
          <span className="por-dentro-fio" />
        </span>
        <h3 className="por-dentro-titulo">{titulo}</h3>
        <p className="por-dentro-texto">{children}</p>
        <div className="por-dentro-recorte" inert>
          <div className="por-dentro-recorte-topo">
            <span className="por-dentro-recorte-titulo">{topo}</span>
            {meta && <span className="por-dentro-recorte-meta">{meta}</span>}
          </div>
          {recorte}
        </div>
      </Reveal>
    </li>
  );
}

export function PorDentro() {
  return (
    <ol className="por-dentro-trilha">
      <Etapa
        num="I"
        titulo="Duas versões da mesma linha"
        atraso={0}
        topo="Pagamento fornecedor #1082"
        meta="04/08"
        recorte={
          <>
            <Linha rotulo="Extrato do banco" valor="R$ 12.640,00" />
            <Linha rotulo="Extrato do sistema" valor="R$ 12.604,00" />
          </>
        }
      >
        O pagamento ao fornecedor chega nos dois arquivos, no mesmo dia, com 36 reais de diferença.
      </Etapa>
      <Etapa
        num="II"
        titulo="O Ledgr acha a diferença"
        atraso={0.08}
        topo="Diferença"
        meta="04/08"
        recorte={
          <div className="por-dentro-recorte-corpo">
            <span className="det-delta-valor">Δ 36,00</span>
            <span className="tag tag-outline">{SELO.rotulo}</span>
          </div>
        }
      >
        Casa as duas pela data, mede a diferença e dá o nome da categoria. É uma das 41 desse tipo em agosto.
      </Etapa>
      <Etapa
        num="III"
        titulo="E diz o motivo"
        atraso={0.16}
        topo="O que provavelmente aconteceu"
        recorte={
          <div className="por-dentro-recorte-corpo por-dentro-motivo">
            <Image
              src="/mascotes/mascote-explicando.png"
              alt=""
              width={1000}
              height={1000}
              sizes="56px"
              style={{ width: 56, height: "auto", flex: "none" }}
            />
            <p className="det-causa-texto">{MOTIVO_VALOR}</p>
          </div>
        }
      >
        Cada divergência vem com o que provavelmente aconteceu. Quem decide o que corrigir é você.
      </Etapa>
      <Etapa
        num="IV"
        titulo="Você corrige no seu sistema"
        atraso={0.24}
        topo="Seu sistema de gestão"
        recorte={
          <>
            <Linha rotulo="Ajuste" valor="+ R$ 36,00" />
            <div className="por-dentro-recorte-linha por-dentro-relatorio">
              <FileDown size={16} aria-hidden="true" />
              Relatório em CSV para o contador
            </div>
          </>
        }
      >
        O extrato do banco é a fonte da verdade: o ajuste é no seu sistema de gestão, e a linha vai no
        relatório para o contador.
      </Etapa>
    </ol>
  );
}
