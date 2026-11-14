import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { carregarConciliacoes } from "../conciliacoes/acoes";
import { Reveal } from "@/app/reveal";
import { Cabecalho } from "../cabecalho";
import { FalhaAoCarregar } from "../falha-ao-carregar";
import { SemNada } from "../sem-nada";
import { formatarInteiro } from "./resumo";
import { agruparPorMes, passaNoFiltro } from "./lista";
import { ListaDeTrabalho } from "./lista-de-trabalho";

/**
 * Conciliações como lista de trabalho: cada extrato do banco uma vez, na rodada que vale, agrupada
 * pelo mês como folhas, com o que ainda falta decidir e a prévia da escolhida ao lado. O resumo do mês fica na visão geral,
 * o trabalho linha a linha na comparação e o que já aconteceu no histórico.
 */

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const resposta = await carregarConciliacoes();
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");

  const conciliacoes = resposta.ok ? resposta.dados.conciliacoes : [];
  // a mesma conta do filtro "Pedem decisão": num mês fechado nada mais se decide
  const pendentes = agruparPorMes(conciliacoes, resposta.ok ? resposta.dados.fechamentos : null).reduce(
    (soma, mes) => soma + mes.conciliacoes.filter((item) => passaNoFiltro(item, mes.fechamento !== null, "pendentes")).length,
    0,
  );
  // a primeira da fila que pede decisão: abre escolhida na prévia, com as conferidas que só ela traz
  const emAndamento = resposta.ok ? resposta.dados.emAndamento : null;

  return (
    <div>
      {/* o menu chama esta tela de Conciliações: o título é o mesmo */}
      <Cabecalho
        titulo="Conciliações"
        contexto={[
          conciliacoes.length > 0 && plural(conciliacoes.length, "conciliação", "conciliações"),
          pendentes > 0 && `${formatarInteiro(pendentes)} ${pendentes === 1 ? "pede" : "pedem"} decisão`,
        ]}
      />

      {!resposta.ok ? (
        <FalhaAoCarregar oQue="suas conciliações" status={resposta.status} />
      ) : conciliacoes.length === 0 ? (
        <SemConciliacoes />
      ) : (
        <div className="conc-corpo">
          <Reveal>
            <ListaDeTrabalho
              conciliacoes={conciliacoes}
              fechamentos={resposta.dados.fechamentos}
              parcial={resposta.dados.parcial}
              emAndamento={emAndamento}
            />
          </Reveal>
        </div>
      )}
    </div>
  );
}

function SemConciliacoes() {
  return <SemNada titulo="Nenhuma conciliação ainda." texto="Envie o extrato do banco e o extrato do sistema. A primeira conciliação fica pronta em poucos minutos." />;
}
