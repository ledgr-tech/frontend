import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, EmDefinicao } from "../documento-legal";

export const metadata: Metadata = {
  title: "Termos de uso · Ledgr",
  description: "As regras de uso do Ledgr, que concilia o extrato do banco com o do sistema de gestão da sua empresa.",
};

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de uso" versao="11 de novembro de 2026">
      <h2>O serviço</h2>
      <p>
        O Ledgr concilia o extrato do banco com o extrato do sistema de gestão da sua empresa: casa os
        lançamentos, aponta o que diverge e sugere o porquê. O extrato do banco é sempre a fonte da
        verdade, e toda divergência aparece como “o sistema diverge do banco”.
      </p>

      <h2>A fase atual</h2>
      <p>
        O Ledgr está em desenvolvimento. Funções podem mudar ou sair do ar para ajustes. As telas
        marcadas como demonstração, como Assinatura e Regras, mostram dados de exemplo e não alteram nada.
        Nenhuma cobrança é feita pelo app hoje.
      </p>

      <h2>A sua conta</h2>
      <ul>
        <li>Quem cria a conta, ou cadastra uma empresa nela, declara que pode agir em nome dessa empresa.</li>
        <li>
          Mantenha a senha só com você. Se desconfiar que mais alguém sabe, troque a senha ou escreva para
          o suporte.
        </li>
        <li>
          Uma conta pode ter várias empresas e várias pessoas, cada uma com um papel: administrador, gestor
          ou analista. O papel decide o que cada pessoa pode fazer, como fechar o mês ou conectar uma IA.
        </li>
      </ul>

      <h2>O que você envia</h2>
      <ul>
        <li>Envie só extratos que a sua empresa tem o direito de usar.</li>
        <li>
          Os dados continuam sendo da sua empresa. O Ledgr os usa só para prestar o serviço, como descreve
          a <Link href="/privacidade">Política de privacidade</Link>.
        </li>
        <li>
          Para prestar o serviço, a sua empresa autoriza o Ledgr a usar os fornecedores listados na
          Política de privacidade, entre eles a OpenAI para as explicações por IA.
        </li>
      </ul>

      <h2>Resultados e explicações</h2>
      <p>
        O Ledgr ajuda a encontrar as divergências, mas quem decide o que lançar é você ou o seu contador.
        Confira antes de ajustar a contabilidade.
      </p>
      <p>
        As explicações por IA são geradas pela OpenAI quando a conciliação roda, para cada divergência, a
        partir de dados reduzidos da linha, como descreve a Política de privacidade. Elas são sugestões, podem errar, não são orientação
        contábil nem fiscal e vêm marcadas como “Gerada por IA”. A IA não muda o status da linha nem
        registra decisão.
      </p>
      <p>
        O recurso tem um limite diário por empresa e pode ficar indisponível, por exemplo quando o provedor
        não responde. Nesses casos aparece o texto padrão do Ledgr, e a conciliação continua funcionando
        normalmente.
      </p>

      <h2>Conexão com o ChatGPT ou o Claude</h2>
      <ul>
        <li>A conexão é opcional, e só o administrador ou o gestor da conta pode autorizá-la.</li>
        <li>
          Quem autoriza declara que a empresa escolhida permite compartilhar os dados que a conexão lê com a
          IA e com quem a oferece, como a OpenAI ou a Anthropic.
        </li>
        <li>
          A conexão só lê e vale para uma empresa. O administrador ou o gestor pode revogá-la a qualquer
          momento em Configurações › Conexões, e o acesso acaba na hora. O Ledgr pode suspender ou desligar
          a conexão, por exemplo para proteger a conta ou o serviço.
        </li>
        <li>
          As respostas são da IA, não do Ledgr, e podem errar: confira os números no Ledgr antes de decidir.
          O que a conexão lê, e o que nunca lê, está na{" "}
          <Link href="/privacidade#conexao-ia">Política de privacidade</Link>.
        </li>
      </ul>

      <h2>O que não é permitido</h2>
      <ul>
        <li>tentar acessar dados de outra empresa ou contornar o login;</li>
        <li>enviar arquivo que não seja extrato, ou que tenha código malicioso;</li>
        <li>
          tentar manipular as explicações por IA, por exemplo escrevendo instruções nas descrições dos
          extratos;
        </li>
        <li>
          sobrecarregar o serviço de propósito, ou automatizar acessos por fora da API e das conexões que o
          Ledgr oferece, sem combinar com a gente.
        </li>
      </ul>

      <h2>Encerramento</h2>
      <p>
        Você pode pedir o encerramento da conta e a exclusão dos dados a qualquer momento, por e-mail.
      </p>

      <EmDefinicao>
        plano e cobrança, limites de responsabilidade, o prazo de exclusão dos dados depois do
        encerramento, a lei aplicável e o foro. Estes pontos entram na versão revisada.
      </EmDefinicao>

      <h2>Mudanças</h2>
      <ul>
        <li>
          11 de novembro de 2026: as várias empresas e os papéis de uma conta, e a conexão com o ChatGPT ou o
          Claude.
        </li>
        <li>
          29 de outubro de 2026: as explicações por IA passaram a ser geradas ao conciliar. A data no topo
          continuou 20 de outubro.
        </li>
        <li>20 de outubro de 2026: as explicações por IA, só quando pedidas, e a OpenAI como fornecedora.</li>
        <li>27 de setembro de 2026: primeira versão.</li>
      </ul>
    </DocumentoLegal>
  );
}
