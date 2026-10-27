import { Reveal } from "../reveal";

// "Para quem é" (mentoria de 26/10, #233): os quatro perfis que o Ledgr atende, logo antes do
// preço e do "Começar agora". Só o que o produto já faz; nada de teste sem cartão nem integração
// com o sistema, que ainda não estão no ar. Rascunho: o texto final passa pela revisão dos sócios.
type Perfil = { nome: string; quem: string; pontos: string[] };

export const PERFIS: Perfil[] = [
  {
    nome: "Escritório contábil",
    quem: "Atende várias empresas e fecha o mês de todas.",
    pontos: [
      "Cada empresa cliente no seu CNPJ, a um clique da outra",
      "O analista justifica; o gestor aprova e fecha o mês",
      "O relatório do fechamento pronto para mandar ao cliente",
    ],
  },
  {
    nome: "Empresa",
    quem: "Confere o próprio banco contra o sistema de gestão.",
    pontos: [
      "Funciona com o sistema que você já usa",
      "Só o que não bate pede atenção, já com o motivo",
      "O mês fechado fica registrado, com quem fechou",
    ],
  },
  {
    nome: "Usuário único",
    quem: "Uma pessoa, um extrato e o mês em dia.",
    pontos: [
      "Dois arquivos e a comparação abre sozinha",
      "Preço pelo volume de lançamentos, sem cobrança por usuário",
      "Sem fidelidade nem taxa de implantação",
    ],
  },
  {
    nome: "Consultor contábil",
    quem: "Acompanha alguns clientes de perto.",
    pontos: [
      "Cada cliente separado, sem misturar extratos",
      "Uma justificativa escrita para cada diferença",
      "A conciliação em CSV e o fechamento em PDF",
    ],
  },
];

export function ParaQuem() {
  return (
    <>
      <Reveal className="para-quem-abertura">
        <p className="rotulo-parte rotulo-parte-ledgr">Para quem é</p>
        <h2 className="titulo-misto" style={{ margin: 0, fontSize: "clamp(30px, 2.8vw, 46px)" }}>
          Para quem fecha o mês, <em>sozinho ou com equipe.</em>
        </h2>
      </Reveal>
      <ul className="para-quem-grade">
        {PERFIS.map((perfil, i) => (
          <li key={perfil.nome}>
            <Reveal delay={0.06 * i} className="para-quem-cartao">
              <h3 className="para-quem-nome">{perfil.nome}</h3>
              <p className="para-quem-quem">{perfil.quem}</p>
              <ul className="para-quem-pontos">
                {perfil.pontos.map((ponto) => (
                  <li key={ponto}>{ponto}</li>
                ))}
              </ul>
            </Reveal>
          </li>
        ))}
      </ul>
    </>
  );
}
