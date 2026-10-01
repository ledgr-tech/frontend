import { Reveal } from "@/app/reveal";
import type { Depoimento } from "@/lib/depoimentos";

/**
 * Depoimentos, no desenho da seção "Clarity." do Floria (floria-landing-page.vercel.app): faixa
 * escura, título centralizado e os cards desencontrados numa grade de 12 colunas, cada um com
 * largura e altura próprias (globals.css, bloco "Depoimentos"). No nosso estilo: o card é filete
 * dourado na faixa, como os de Preços, sem o vidro e sem o brilho do Floria (o DESIGN.md veta os
 * dois), e os cards não se encavalam como lá.
 *
 * Sem depoimentos a seção não existe: nada de seção vazia, nem de exemplo inventado no lugar.
 */

const ESTRELAS = [1, 2, 3, 4, 5];

function Nota({ nota }: { nota: number }) {
  return (
    <span className="depoimento-nota" role="img" aria-label={`Nota ${nota} de 5`}>
      {ESTRELAS.map((estrela) => (
        <svg key={estrela} className="depoimento-estrela" data-cheia={estrela <= nota || undefined} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.1 5.9L12 16.5l-5.3 2.9 1.1-5.9-4.4-4.1 6-.7z" />
        </svg>
      ))}
    </span>
  );
}

function CartaoDepoimento({ depoimento }: { depoimento: Depoimento }) {
  const assinatura = depoimento.empresa ? `${depoimento.cargo}, ${depoimento.empresa}` : depoimento.cargo;
  return (
    <figure className="depoimento">
      <span className="depoimento-aspas" aria-hidden="true">
        “
      </span>
      {depoimento.nota !== undefined && <Nota nota={depoimento.nota} />}
      <blockquote className="depoimento-citacao">
        <p>{depoimento.citacao}</p>
      </blockquote>
      <figcaption className="depoimento-autor">
        {/* a inicial, sem foto: o nome vem logo ao lado, e foto pediria outra autorização */}
        <span className="depoimento-avatar" aria-hidden="true">
          {depoimento.nome.charAt(0)}
        </span>
        <span className="depoimento-quem">
          <span className="depoimento-nome">{depoimento.nome}</span>
          <span className="depoimento-cargo">{assinatura}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export function Depoimentos({ depoimentos }: { depoimentos: Depoimento[] }) {
  if (depoimentos.length === 0) return null;

  return (
    // a onda de cima é a cor da Regra de ouro (papel), a seção anterior
    <section id="depoimentos" className="onda onda-papel grao depoimentos-secao">
      <div className="depoimentos-conteudo">
        <Reveal className="depoimentos-topo">
          <h2 className="titulo-misto depoimentos-titulo">
            Quem já concilia, <em>conta.</em>
          </h2>
          <div className="depoimentos-filete" aria-hidden="true" />
        </Reveal>
        <ul className="depoimentos-grade">
          {depoimentos.map((depoimento, i) => (
            <li key={depoimento.nome}>
              <Reveal delay={0.08 + (i % 2) * 0.1}>
                <CartaoDepoimento depoimento={depoimento} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
