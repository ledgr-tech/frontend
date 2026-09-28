import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, EmDefinicao } from "../documento-legal";

export const metadata: Metadata = { title: "Política de privacidade · Ledgr" };

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
          <strong>O que fica só no seu navegador:</strong> as preferências de tela (tema, densidade das
          tabelas, menu recolhido), a saudação do login e a contagem de tentativas de entrada. O cadastro
          também pergunta o banco, a conta e o sistema de gestão; hoje essas respostas não são enviadas nem
          guardadas.
        </li>
      </ul>

      <h2>Para que, e com que base legal</h2>
      <p>
        Para prestar o serviço: ler os extratos, conciliar, mostrar as divergências, exportar o relatório
        e manter você conectado. A base legal é a execução do contrato com a sua empresa (art. 7º, V, da
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
        Na tela de uma divergência, você pode pedir uma explicação gerada por IA. Ela só é gerada quando
        você clica. Antes de sair do Ledgr, a descrição do lançamento é mascarada: CPF, CNPJ, e-mail,
        telefone e qualquer sequência de seis ou mais dígitos viram marcadores. Nomes de pessoas não são
        mascarados. O provedor é a OpenAI, e a chamada pede que ela não guarde o conteúdo. A explicação
        gerada fica guardada no Ledgr, para não ser gerada de novo. O recurso só é ligado depois de aceito
        o acordo de tratamento de dados com o provedor. A IA explica; quem decide é você.
      </p>

      <h2>Onde os dados ficam</h2>
      <p>
        O Ledgr usa três fornecedores: a Vercel, que hospeda o site e o app; a Railway, que hospeda o
        servidor e o banco de dados; e a OpenAI, para as explicações por IA. Os três processam dados fora
        do Brasil.
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
        <li>Os registros do servidor não guardam o valor nem a descrição completa dos lançamentos.</li>
      </ul>

      <h2>Por quanto tempo</h2>
      <ul>
        <li>O arquivo enviado não é guardado.</li>
        <li>Lançamentos, conciliações, histórico e explicações ficam enquanto a conta existir.</li>
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
        Por enquanto, os pedidos são feitos por e-mail. A exclusão da conta pelas próprias configurações
        ainda não está disponível. Nos extratos, em que a sua empresa é a controladora, o pedido de uma
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
