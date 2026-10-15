import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, EmDefinicao } from "../documento-legal";

export const metadata: Metadata = { title: "Termos de uso · Ledgr" };

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de uso">
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
        <li>Quem cria a conta declara que pode agir em nome da empresa cadastrada.</li>
        <li>
          Mantenha a senha só com você. Se desconfiar que mais alguém sabe, troque a senha ou escreva para
          o suporte.
        </li>
        <li>Hoje, cada empresa tem uma conta, com um usuário.</li>
      </ul>

      <h2>O que você envia</h2>
      <ul>
        <li>Envie só extratos que a sua empresa tem o direito de usar.</li>
        <li>
          Os dados continuam sendo da sua empresa. O Ledgr os usa só para prestar o serviço, como descreve
          a <Link href="/privacidade">Política de privacidade</Link>.
        </li>
      </ul>

      <h2>Resultados e explicações</h2>
      <p>
        O Ledgr ajuda a encontrar as divergências, mas quem decide o que lançar é você ou o seu contador.
        Confira antes de ajustar a contabilidade. As explicações geradas por IA são sugestões, podem errar
        e vêm marcadas como “Gerada por IA”.
      </p>

      <h2>O que não é permitido</h2>
      <ul>
        <li>tentar acessar dados de outra empresa ou contornar o login;</li>
        <li>enviar arquivo que não seja extrato, ou que tenha código malicioso;</li>
        <li>sobrecarregar o serviço de propósito, ou automatizar acessos sem combinar com a gente.</li>
      </ul>

      <h2>Encerramento</h2>
      <p>
        Você pode pedir o encerramento da conta e a exclusão dos dados a qualquer momento, por e-mail.
      </p>

      <EmDefinicao>
        plano e cobrança, limites de responsabilidade, o prazo de exclusão dos dados depois do
        encerramento, a lei aplicável e o foro. Estes pontos entram na versão revisada.
      </EmDefinicao>
    </DocumentoLegal>
  );
}
