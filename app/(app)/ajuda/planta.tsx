import type { ReactNode } from "react";
import type { PaginaDeAjuda } from "./paginas";

/** O número do passo, preso ao elemento da miniatura que ele aponta. */
type Marcar = (passo: number) => ReactNode;

/**
 * A tela em miniatura, desenhada com os mesmos tokens do app: segue o tema e não envelhece como um
 * print quando a tela muda de cor. Cada número fica dentro do elemento que o passo aponta, então
 * acompanha a miniatura em qualquer largura.
 */
const PLANTAS: Record<string, (m: Marcar) => ReactNode> = {
  "nova-conciliacao": (m) => (
    <>
      <span className="ajd-planta-titulo">Nova conciliação</span>
      <span className="ajd-planta-linha">
        <span className="ajd-planta-arquivo">
          {m(1)}
          <b>Extrato do banco</b>OFX ou CSV
        </span>
        <span className="ajd-planta-arquivo">
          {m(2)}
          <b>Extrato do sistema de gestão</b>CSV
        </span>
      </span>
      <span className="ajd-planta-botao">
        {m(3)}
        Conciliar extratos →
      </span>
    </>
  ),
  "apontar-colunas": (m) => (
    <>
      <span className="ajd-planta-titulo">Importação interrompida</span>
      <span className="ajd-planta-tabela">
        {m(1)}
        <span>
          <span>Coluna A ▾{m(2)}</span>
          <span>Coluna B ▾</span>
          <span>Coluna C ▾</span>
        </span>
        <span>
          <span>03/10</span>
          <span>PIX Aço Norte</span>
          <span>-12.640,00</span>
        </span>
        <span>
          <span>04/10</span>
          <span>Tarifa pacote</span>
          <span>-39,90</span>
        </span>
      </span>
      <span className="ajd-planta-botao ajd-planta-botao-ouro">
        {m(3)}
        Retomar a importação
      </span>
    </>
  ),
  comparacao: (m) => (
    <>
      <span className="ajd-planta-titulo">Outubro de 2026</span>
      <span className="ajd-planta-barra">
        {m(1)}
        <i />
      </span>
      <span className="ajd-planta-linha">
        <span className="ajd-planta-arquivo ajd-planta-lado">
          {m(2)}
          <b>Banco</b>
          <span>
            <i className="ajd-planta-ponto" />
            Boleto Aço Norte · -12.640,00
          </span>
          <span>Tarifa · -39,90</span>
        </span>
        <span className="ajd-planta-arquivo ajd-planta-lado">
          {m(3)}
          <b>Sistema</b>
          <span>
            <i className="ajd-planta-ponto" />
            Aço Norte Bobinas · -12.604,00
          </span>
          <span>Tarifa · -39,90</span>
        </span>
      </span>
    </>
  ),
  justificar: (m) => (
    <>
      <span className="ajd-planta-titulo">Boleto Aço Norte Bobinas</span>
      <span className="ajd-planta-linha">
        <span className="ajd-planta-arquivo ajd-planta-lado">
          {m(1)}
          <b>Banco</b>-R$ 12.640,00
        </span>
        <span className="ajd-planta-arquivo ajd-planta-lado">
          <b>Sistema</b>-R$ 12.604,00
        </span>
      </span>
      <span className="ajd-planta-linha ajd-planta-acoes">
        <span className="ajd-planta-botao">Conferido</span>
        <span className="ajd-planta-botao ajd-planta-botao-ouro">
          {m(2)}
          Justificar
        </span>
        <span className="ajd-planta-botao ajd-planta-fim-linha">
          {m(3)}
          Fechamentos →
        </span>
      </span>
    </>
  ),
  tolerancia: (m) => (
    <>
      <span className="ajd-planta-titulo">
        {m(1)}
        Conciliação
      </span>
      <span className="ajd-planta-linha ajd-planta-config">
        <span className="ajd-planta-texto">
          <b>Tolerância de data</b>
          <i />
          <i />
        </span>
        <span className="ajd-planta-numero">
          {m(2)}
          <span>−</span>±<em>2</em>dias<span>+</span>
        </span>
      </span>
      <span className="ajd-planta-linha ajd-planta-acoes ajd-planta-fim">
        <span className="ajd-planta-botao ajd-planta-botao-ouro">
          {m(3)}
          Salvar
        </span>
      </span>
    </>
  ),
};

export function Planta({
  pagina,
  marcas = false,
  realce = null,
}: {
  pagina: PaginaDeAjuda;
  marcas?: boolean;
  realce?: number | null;
}) {
  const marcar: Marcar = (passo) =>
    marcas ? (
      <span
        className="ajd-marca"
        data-realce={realce === passo - 1 ? "true" : undefined}
      >
        {passo}
      </span>
    ) : null;
  return (
    <span className="ajd-planta" aria-hidden="true">
      {PLANTAS[pagina.id](marcar)}
    </span>
  );
}
