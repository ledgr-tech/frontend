import Image from "next/image";
import { Reveal } from "../reveal";

// "Para quem é" (mentoria de 26/10, #233; desenho escolhido em 27/10: "Topo 4" com as folhas da "7E"):
// os quatro perfis que o Ledgr atende, logo antes do preço e do "Começar agora", do menor ao maior.
// Só o que o produto já faz; nada de teste sem cartão nem integração com o sistema, que ainda não
// estão no ar. Rascunho: o texto final passa pela revisão dos sócios.
type Perfil = {
  nome: string;
  medida: string;
  quem: string;
  pontos: string[];
  mascote: { src: string; width: number; height: number };
};

export const PERFIS: Perfil[] = [
  {
    nome: "Usuário único",
    medida: "1 pessoa · 1 empresa",
    quem: "Uma pessoa, um extrato e o mês em dia.",
    pontos: [
      "Dois arquivos e a comparação abre sozinha",
      "Preço pelo volume de lançamentos, sem cobrança por usuário",
      "Sem fidelidade nem taxa de implantação",
    ],
    mascote: { src: "/mascotes/mascote-laptop.png", width: 824, height: 720 },
  },
  {
    nome: "Consultor contábil",
    medida: "1 pessoa · alguns clientes",
    quem: "Acompanha alguns clientes de perto.",
    pontos: [
      "Cada cliente separado, sem misturar extratos",
      "Uma justificativa escrita para cada diferença",
      "A conciliação em CSV e o fechamento em PDF",
    ],
    mascote: { src: "/mascotes/mascote-maleta.png", width: 778, height: 720 },
  },
  {
    nome: "Empresa",
    medida: "a sua empresa · o financeiro",
    quem: "Confere o próprio banco contra o sistema de gestão.",
    pontos: [
      "Funciona com o sistema que você já usa",
      "Só o que não bate pede atenção, já com o motivo",
      "O mês fechado fica registrado, com quem fechou",
    ],
    mascote: { src: "/mascotes/mascote-loja.png", width: 952, height: 720 },
  },
  {
    nome: "Escritório contábil",
    medida: "várias empresas · equipe",
    quem: "Atende várias empresas e fecha o mês de todas.",
    pontos: [
      "Cada empresa cliente no seu CNPJ, a um clique da outra",
      "O analista justifica; o gestor aprova e fecha o mês",
      "O relatório do fechamento pronto para mandar ao cliente",
    ],
    mascote: { src: "/mascotes/mascote-arquivo.png", width: 758, height: 720 },
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
        <p className="para-quem-frase">Do contador que trabalha sozinho ao escritório com equipe.</p>
      </Reveal>
      {/* a pergunta fica junto dos perfis, onde a pessoa escolhe, e não na abertura */}
      <Reveal>
        <p className="para-quem-pergunta">Qual desses é você?</p>
      </Reveal>
      <ul className="para-quem-grade">
        {PERFIS.map((perfil, i) => (
          <li key={perfil.nome}>
            <Reveal delay={0.06 * i} className="para-quem-perfil">
              <Image
                src={perfil.mascote.src}
                alt=""
                width={perfil.mascote.width}
                height={perfil.mascote.height}
                sizes="160px"
                className="para-quem-mascote"
              />
              <div className="para-quem-folha">
                <h3 className="para-quem-nome">{perfil.nome}</h3>
                <p className="para-quem-medida">{perfil.medida}</p>
                <p className="para-quem-quem">{perfil.quem}</p>
                <ul className="para-quem-pontos">
                  {perfil.pontos.map((ponto) => (
                    <li key={ponto}>{ponto}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </>
  );
}
