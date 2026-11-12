import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, EmDefinicao } from "../documento-legal";

export const metadata: Metadata = {
  title: "Política de privacidade · Ledgr",
  description: "Como o Ledgr trata os dados dos extratos que você envia e os da sua conta.",
};

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de privacidade" versao="11 de novembro de 2026">
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
          <strong>Entrada pelo Google:</strong> se você entra com a sua conta Google, recebemos dela o seu
          nome, o seu e-mail e o identificador da conta Google. O Ledgr guarda o identificador para
          reconhecer você nos próximos acessos.
        </li>
        <li>
          <strong>Convites e equipe:</strong> quando alguém da sua conta convida uma pessoa, o e-mail dela
          fica guardado no convite. Quem é removido da equipe perde o acesso na hora, mas o nome continua no
          histórico de decisões da empresa.
        </li>
        <li>
          <strong>Cidade e estado da conta:</strong> preenchidos pela consulta do CNPJ ou informados por você
          no cadastro, para sabermos em que regiões estão nossos clientes. Esses dois dados não são
          compartilhados com ninguém e não aparecem na API nem nas conexões com assistentes de IA.
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
        O principal cookie do Ledgr é o da sessão, que mantém você conectado por até 7 dias contados do
        login, ou até fechar o navegador se você desmarcar “Manter sessão ativa”. Os outros servem só ao
        funcionamento do app:
      </p>
      <ul>
        <li>a última empresa que você abriu, para o app voltar a ela (fica só no seu navegador);</li>
        <li>
          durante uma entrada, um cadastro ou o aceite de um convite pelo Google, os dados dessa etapa, por
          até 1 hora;
        </li>
        <li>o aviso de conta inativa, por até 10 minutos depois de uma ação recusada.</li>
      </ul>
      <p>
        A página não consegue ler o cookie da sessão nem os do Google e do aviso. Não há cookie de
        publicidade nem de análise de audiência.
      </p>

      <h2>Quando os dados saem da sua conta por escolha sua</h2>
      <ul>
        <li>
          <strong>Link público do relatório:</strong> o administrador ou o gestor da conta pode gerar um link do
          relatório de um mês fechado e enviá-lo a quem quiser, como o contador. Quem tiver o link vê, sem
          login, a razão social, o CNPJ, os números do mês e as linhas justificadas e pendentes, com a
          descrição de cada lançamento, que pode conter o nome de uma pessoa. A escolha de com quem
          compartilhar é sua. O link vale de 1 a 90 dias, pode ser revogado a qualquer momento e deixa de
          abrir se o mês for reaberto.
        </li>
        <li>
          <strong>Chaves de API:</strong> o administrador ou o gestor da conta pode criar chaves para ferramentas que a
          própria empresa conecta, como o sistema de gestão ou uma planilha. Elas só leem dados, sem a
          descrição dos lançamentos nem nomes, e param de funcionar na hora em que são revogadas.
        </li>
        <li>
          <strong>Conexão com o ChatGPT ou o Claude:</strong> o administrador ou o gestor da conta pode
          conectar uma dessas IAs a uma empresa, para perguntar sobre as conciliações dela numa conversa. O
          que ela lê e para onde os dados vão estão na seção seguinte.
        </li>
      </ul>

      <h2 id="conexao-ia">Conexão com o ChatGPT ou o Claude</h2>
      <p>
        A conexão é opcional e só lê: não confere, não justifica, não fecha mês e não muda nada no Ledgr. Só
        o administrador ou o gestor da conta pode autorizá-la, cada conexão vale para uma empresa, e a conta
        tem no máximo 10 conexões ativas.
      </p>
      <ul>
        <li>
          <strong>O que a IA lê:</strong> a razão social e o CNPJ da empresa escolhida (numa empresa
          individual, a razão social costuma ser o nome do dono), os meses com conciliação e se estão
          fechados, os números de cada mês e de cada conciliação, as divergências (categoria, data, valor,
          situação e o lado, banco ou sistema), o período de cada extrato e a data de cada conciliação, e os
          fechamentos, com a informação de se houve ressalva.
        </li>
        <li>
          <strong>O que ela nunca recebe:</strong> a descrição dos lançamentos, o texto das justificativas e
          das ressalvas, o nome de quem usa o Ledgr, nomes de arquivos, e a cidade e o estado da conta.
        </li>
        <li>
          <strong>Para onde vai:</strong> para a conta de IA de quem conectou, na OpenAI (ChatGPT) ou na
          Anthropic (Claude). Aqui elas não são fornecedoras do Ledgr: tratam o que recebem pelas regras da
          conta que a pessoa tem com elas, como as de guardar as conversas e de usá-las para treinar
          modelos. Quem conecta um programa do próprio computador, como o Claude Code, manda os dados para
          esse programa e para a IA que ele usa. O Ledgr não controla o que acontece com os dados depois que
          chegam lá.
        </li>
        <li>
          <strong>Como parar:</strong> o administrador ou o gestor revoga a conexão a qualquer momento em
          Configurações › Conexões, e o acesso acaba na hora. Remover o Ledgr no ChatGPT ou no Claude pode
          não revogar a conexão: para ter certeza, revogue também no Ledgr. Ela também acaba sozinha quando
          quem a criou sai da equipe, desativa a própria conta ou passa a analista. Revogar não apaga o que a
          IA já leu.
        </li>
        <li>
          <strong>O que o Ledgr registra:</strong> qual ferramenta foi usada, por qual conexão e se deu
          certo, sem guardar o que foi respondido. A lista de conexões mostra quem autorizou cada uma,
          quando, a empresa e o último uso.
        </li>
      </ul>

      <h2>O que a equipe do Ledgr vê</h2>
      <p>
        Para suporte e cobrança, a equipe do Ledgr tem um painel interno com os dados comerciais de cada
        conta (plano, situação da assinatura, pagamentos, cidade e estado), o contato de quem administra a
        conta e contagens de uso. O painel não mostra lançamentos, descrições, justificativas, nomes de
        arquivo nem dados das empresas clientes além das contagens, e nenhum dado de cartão passa pelo
        Ledgr. Cada acesso ao painel fica registrado, com quem acessou e qual conta foi consultada.
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
        <li>O registro de acessos ao painel interno da equipe do Ledgr fica por 1 ano.</li>
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
      <ul>
        <li>
          11 de novembro de 2026: entrada pelo Google, convites, cidade e estado da conta, link público do
          relatório, chaves de API, conexão com o ChatGPT ou o Claude, o que a equipe do Ledgr vê e os
          cookies.
        </li>
        <li>
          29 de outubro de 2026: as explicações por IA passaram a ser geradas ao conciliar, e entrou a
          desativação da conta. A data no topo continuou 20 de outubro.
        </li>
        <li>20 de outubro de 2026: as explicações por IA, só quando pedidas, e o cadastro sem o passo do banco.</li>
        <li>27 de setembro de 2026: primeira versão.</li>
      </ul>
    </DocumentoLegal>
  );
}
