import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, EmDefinicao } from "../documento-legal";

export const metadata: Metadata = {
  title: "Política de privacidade · Ledgr",
  description: "Como o Ledgr trata os dados dos extratos que você envia e os da sua conta.",
};

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de privacidade">
      <h2>Quem é quem</h2>
      <p>
        O Ledgr concilia o extrato do banco com o extrato do sistema de gestão da sua empresa. Nos
        extratos que você envia, a sua empresa é a controladora dos dados e o Ledgr é o operador: trata
        esses dados só para fazer a conciliação que você pediu. Nos dados da sua conta, que dizem quem
        você é e como você entra, o Ledgr é o controlador.
      </p>

      <h2>Que dados tratamos</h2>
      <ul>
        <li>
          <strong>Da conta:</strong> seu nome, seu e-mail, a razão social e o CNPJ da empresa. A senha é
          guardada só como hash, um resumo criptográfico que não permite ler a senha de volta.
        </li>
        <li>
          <strong>Dos extratos:</strong> a data, o valor e a descrição de cada lançamento dos arquivos que
          você envia, o resultado da conciliação e o histórico das conciliações. A descrição pode conter o
          nome de uma pessoa, como num Pix ou num pagamento a fornecedor.
        </li>
        <li>
          <strong>O arquivo enviado não é guardado.</strong> O Ledgr lê os lançamentos e descarta o
          arquivo em seguida.
        </li>
        <li>
          <strong>Das explicações por IA:</strong> o texto de cada explicação gerada, ligado à sua empresa.
          O que foi enviado ao provedor para gerar a explicação não é guardado.
        </li>
        <li>
          <strong>O que fica só no seu navegador:</strong> as preferências de tela (tema, densidade das
          tabelas, menu recolhido), a saudação do login e a contagem de tentativas de entrada. O cadastro
          também pergunta o sistema de gestão e o e-mail do responsável; hoje essas respostas não são
          enviadas nem guardadas.
        </li>
      </ul>

      <h2>Para que, e com que base legal</h2>
      <p>
        Para prestar o serviço: ler os extratos, conciliar, mostrar as divergências, gerar as explicações
        por IA que você pedir, exportar o relatório, enviar os e-mails do serviço (como o de recuperação de
        senha) e manter você conectado. A base legal é a execução do contrato com a sua empresa (art. 7º, V, da
        LGPD). O Ledgr não vende dados e não os usa para publicidade.
      </p>

      <h2>Cookies</h2>
      <p>
        O Ledgr usa um único cookie, o da sessão, que mantém você conectado por até 7 dias, ou até fechar
        o navegador se você desmarcar “Manter sessão ativa”. A página não consegue ler esse cookie. Não há
        cookie de publicidade nem de análise de audiência.
      </p>

      <h2>Explicações por IA</h2>
      <p>
        Cada divergência vem com uma explicação gerada por IA. Ela é gerada quando a conciliação roda, sem
        que você precise pedir; se alguma ainda não estiver pronta, você pode pedi-la na tela da linha em
        “Explicar esta divergência”. Linhas conciliadas não são enviadas à IA. O provedor é a OpenAI, com quem o Ledgr tem um acordo de tratamento de dados assinado. Pelo acordo, a OpenAI só
        pode usar esses dados para prestar o serviço ao Ledgr.
      </p>
      <ul>
        <li>
          <strong>O que é enviado:</strong> o status da linha, a data, o valor e o tipo do lançamento e dos
          lançamentos parecidos do outro extrato, as diferenças de valor e de dias entre eles, quantos
          lançamentos há de cada lado e a descrição reduzida de cada um.
        </li>
        <li>
          <strong>Como a descrição é reduzida:</strong> antes de sair do Ledgr, CPF, CNPJ, e-mail, telefone
          e qualquer sequência de seis ou mais dígitos viram marcadores. Depois, só passam as palavras de
          uma lista fechada de termos bancários, como PIX, TED, BOLETO e TARIFA. Todo o resto, inclusive
          nomes de pessoas e de empresas, vira um marcador. Por exemplo, “PIX ENVIADO MARIA SILVA
          123.456.789-00” sai como “PIX ENVIADO [TEXTO] [CPF]”.
        </li>
        <li>
          <strong>O que não é enviado:</strong> o nome e o CNPJ da sua empresa, o seu nome e o seu e-mail.
          Cada pedido leva um código derivado da identificação da empresa, que a OpenAI usa para detectar
          abuso e que não revela qual empresa é.
        </li>
        <li>
          <strong>Por quanto tempo:</strong> o Ledgr pede que a OpenAI não guarde o pedido na conta do
          Ledgr. Mesmo assim, a OpenAI mantém o conteúdo recebido em registros de monitoramento de abuso por
          até 30 dias, salvo obrigação legal. A explicação gerada fica guardada no Ledgr, para não ser
          gerada de novo.
        </li>
        <li>
          <strong>Quem decide é você:</strong> a IA só explica. Ela não muda o status da linha, não marca
          conferência e não registra decisão. Há um limite diário de explicações por empresa; quando ele
          acaba, ou quando o provedor não responde, aparece o texto padrão do Ledgr.
        </li>
      </ul>

      <h2>Onde os dados ficam</h2>
      <p>
        O Ledgr usa quatro fornecedores: a Vercel, que hospeda o site e o app; a Railway, que hospeda o
        servidor e o banco de dados; a OpenAI, para as explicações por IA; e o Resend, que envia os
        e-mails do serviço, como o de recuperação de senha. Os quatro processam dados fora do Brasil,
        principalmente nos Estados Unidos. Nos extratos, em que o Ledgr é o operador, esses fornecedores
        atuam como suboperadores, com a autorização prevista nos{" "}
        <Link href="/termos">Termos de uso</Link>.
      </p>
      <EmDefinicao>
        o registro das cláusulas-padrão de transferência internacional com cada fornecedor (Resolução
        CD/ANPD nº 19/2024).
      </EmDefinicao>

      <h2 id="seguranca">Segurança</h2>
      <ul>
        <li>
          Cada empresa só vê os próprios dados: todo acesso ao servidor leva a identificação da empresa, e
          o que é de outra empresa aparece como inexistente.
        </li>
        <li>
          O seu navegador nunca fala direto com o servidor do Ledgr: quem fala é o servidor do app, e o
          acesso fica no cookie que a página não lê.
        </li>
        <li>
          Os registros do servidor não guardam o valor nem a descrição completa dos lançamentos, nem o que
          é enviado à IA.
        </li>
      </ul>

      <h2>Por quanto tempo</h2>
      <ul>
        <li>O arquivo enviado não é guardado.</li>
        <li>Lançamentos, conciliações, histórico e explicações ficam enquanto a conta existir.</li>
        <li>
          O que vai para a OpenAI para gerar uma explicação fica até 30 dias nos registros de
          monitoramento de abuso dela.
        </li>
      </ul>
      <EmDefinicao>o prazo de exclusão dos dados depois que a conta é encerrada.</EmDefinicao>

      <h2 id="direitos">Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode pedir:</p>
      <ul>
        <li>a confirmação de que tratamos os seus dados, e acesso a eles;</li>
        <li>a correção de dados incompletos ou errados;</li>
        <li>a eliminação dos dados;</li>
        <li>a portabilidade: o relatório de cada conciliação já sai em CSV, pelo próprio app;</li>
        <li>a informação de com quem compartilhamos: os fornecedores listados acima.</li>
      </ul>
      <p>
        Por enquanto, os pedidos são feitos por e-mail. Nas configurações, você desativa a sua conta: o
        acesso acaba e o e-mail fica livre. A exclusão dos dados da empresa é feita a pedido, por e-mail.
        Nos extratos, em que a sua empresa é a controladora, o pedido de uma
        pessoa citada numa descrição é atendido pela sua empresa, com a ajuda do Ledgr.
      </p>
      <EmDefinicao>o canal próprio de privacidade e a pessoa responsável por ele.</EmDefinicao>

      <h2>Mudanças</h2>
      <p>
        Esta política muda quando o Ledgr muda. A data no topo diz qual versão está valendo. Veja também
        os <Link href="/termos">Termos de uso</Link>.
      </p>
    </DocumentoLegal>
  );
}
