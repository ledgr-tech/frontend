export type Ponto = { x: number; y: number };

/** O recuo do fio até o alvo: a mesma folga do recorte do véu. */
const FOLGA = 8;
const MEIA_ONDA = 8.5;
const AMPLITUDE = 3;
const PONTA = 7;
const ANGULO_DA_PONTA = (28 * Math.PI) / 180;

const n = (v: number) => +v.toFixed(2);

/** O `d` do fio: a reta de→para em meias ondas de ~8,5px, cada uma um Q que alterna +3 e -3 na perpendicular. */
export function caminhoDoFio(de: Ponto, para: Ponto): string {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const distancia = Math.hypot(dx, dy);
  const trechos = Math.max(1, Math.round(distancia / MEIA_ONDA));
  // a perpendicular unitária; numa reta de comprimento zero fica (0, 0) e o fio vira um ponto
  const px = distancia ? -dy / distancia : 0;
  const py = distancia ? dx / distancia : 0;
  let d = `M${n(de.x)} ${n(de.y)}`;
  for (let i = 0; i < trechos; i++) {
    const lado = i % 2 === 0 ? AMPLITUDE : -AMPLITUDE;
    const meio = (i + 0.5) / trechos;
    const fim = i === trechos - 1 ? para : { x: de.x + (dx * (i + 1)) / trechos, y: de.y + (dy * (i + 1)) / trechos };
    d += `Q${n(de.x + dx * meio + px * lado)} ${n(de.y + dy * meio + py * lado)} ${n(fim.x)} ${n(fim.y)}`;
  }
  return d;
}

/** A ponta: dois traços de 7px a ±28° da direção final, saindo de `para`. */
export function pontaDoFio(de: Ponto, para: Ponto): string {
  const volta = Math.atan2(de.y - para.y, de.x - para.x);
  return [1, -1]
    .map((lado) => {
      const a = volta + lado * ANGULO_DA_PONTA;
      return `M${n(para.x)} ${n(para.y)}L${n(para.x + PONTA * Math.cos(a))} ${n(para.y + PONTA * Math.sin(a))}`;
    })
    .join("");
}

/**
 * Onde o fio começa e termina. Nas telas largas, do meio da borda esquerda do cartão ao meio da borda
 * direita do alvo (recuado); nas menores, do meio da borda de cima do painel ao meio da borda de baixo
 * do alvo. Sem fio (null) se o alvo não tem área ou está todo fora da janela.
 */
export function pontasDoFio(cartao: DOMRect, alvo: DOMRect, largas: boolean): { de: Ponto; para: Ponto } | null {
  if (alvo.width <= 0 || alvo.height <= 0) return null;
  if (alvo.right < 0 || alvo.bottom < 0 || alvo.left > window.innerWidth || alvo.top > window.innerHeight) return null;
  return largas
    ? {
        de: { x: cartao.left, y: cartao.top + cartao.height / 2 },
        para: { x: alvo.right + FOLGA, y: alvo.top + alvo.height / 2 },
      }
    : {
        de: { x: cartao.left + cartao.width / 2, y: cartao.top },
        para: { x: alvo.left + alvo.width / 2, y: alvo.bottom },
      };
}
