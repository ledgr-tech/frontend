// Grava as telas da Central de ajuda (#199) em HTML, para a Central tocar (demonstracao.tsx): um roteiro por tela em
// ROTEIROS, com os textos da página dela em app/(ajuda)/ajuda/paginas.ts, e as figuras das seções, uma receita por
// página em FIGURAS.
//
// Como rodar (Windows, Git Bash), com o backend-fake recém-subido como a produção está (conta Telha Certa):
//   PORT=8001 APROVACAO_JUSTIFICATIVAS_HABILITADA=0 MCP_HABILITADO=0 node scripts/backend-fake.mjs
// e o front de produção local em :3950 (npm run build; LEDGR_API_URL=http://localhost:8001 AUTH_TRUST_HOST=true
// npx next start -p 3950):
//   node scripts/ajuda-videos/gravar.mjs comparacao extratos ...    → public/ajuda/<tela>.json (campo demonstracao)
//   node scripts/ajuda-videos/gravar.mjs --figuras extratos ...      → public/ajuda/<tela>--figuras.json (campo figura,
//                                                                      com o tamanho que ele mostra de cada uma)
// Sem tela, grava todas. A Nova conciliação ENVIA os CSVs de verdade e o Detalhe da linha justifica uma linha: grave
// cada uma com o backend-fake recém-subido, senão a conciliação repete e as outras telas mostram a justificativa.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:3950";
// a conta de teste do backend-fake
const EMAIL = process.env.EMAIL ?? "financeiro@telhacerta.com.br";
const SENHA = process.env.SENHA ?? "ledgr2026";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(AQUI, "..", "..", "public", "ajuda");
const FIGURAS_ = process.argv.includes("--figuras");

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// o que roteiros e receitas usam para andar pelo app, dentro da empresa; capturar() acrescenta a legenda, o
// destaque e os cliques, que viram passos
function ferramentas(page, empresa) {
  return {
    page,
    abrir: async (tela) => {
      await page.goto(`${BASE}/e/${empresa}/${tela}`);
      await page.waitForLoadState("networkidle");
    },
    esperar: async (padrao) => {
      await page.waitForURL(padrao, { timeout: 90000 });
      await page.waitForLoadState("networkidle");
      await pausa(800);
    },
  };
}

const botao = (page, nome) => page.getByRole("button", { name: nome }).first();
// os cartões têm aria-label próprio, diferente do texto: estes se acham pelo que mostram
const cartao = (page, texto) => page.locator("button:visible").filter({ hasText: texto }).first();
const grupoDe = (loc) => loc.locator("xpath=..");
const alvo = (page, nome) => page.locator(`[data-tutorial=${nome}]:visible`).first();
const abrirComparacao = async (t) => {
  await t.abrir("dashboard");
  await t.page.getByRole("link", { name: /abrir a comparação/i }).click();
  await t.esperar(/\/conciliacoes\/[0-9a-f-]{20,}/);
};
const linhaParaJustificar = (page) =>
  page.locator("main tbody tr").filter({
    has: page.locator('button[aria-label*="como conferida"]:not([aria-pressed="true"])'),
  }).first();

// inicio: a tela em que a captura começa; antes: o que roda antes dela; cena: os passos
const ROTEIROS = {
  "visao-geral": {
    inicio: "visao-geral",
    async cena(t, { page }) {
      await t.passo(null, "", "A primeira tela depois do login", "Mostra como está o mês aberto e o que pede sua atenção agora.", 3800);
      await t.passo(alvo(page, "estado-do-mes"), "1", "O mês em um número", "Quantos lançamentos do mês aberto já foram conciliados, e quanto ainda está em aberto.", 5000);
      await t.passo(alvo(page, "atalhos"), "2", "Atalhos para Extratos, Conciliações, Fechamentos e Histórico", "Cada um com o resumo do que tem lá. Clique para abrir a tela.", 5000);
      const recente = page.getByRole("link", { name: /^Ver 10-outubro/ });
      await t.passo(recente, "3", "As últimas conciliações", "Quando rodou e quanto bateu. Clique numa para abrir a comparação dela.", 3600);
      await t.clicar(recente);
      await t.esperar(/\/conciliacoes\/[0-9a-f-]{20,}/);
      await t.passo(null, "", "A comparação dessa conciliação abre", "", 2600);
    },
  },

  extratos: {
    inicio: "extratos",
    async cena(t, { page }) {
      await t.passo(null, "", "Todos os arquivos que você enviou", "Do banco e do sistema de gestão, conciliados ou não.", 3600);
      const todos = botao(page, /^Todos \(/);
      await t.passo(grupoDe(todos), "1", "Filtre por tipo", "**Todos**, **Do banco**, **Do sistema** ou **Com problema**.", 2600);
      await t.clicar(botao(page, /^Do banco/));
      await pausa(1600);
      await t.clicar(botao(page, /^Com problema/));
      await pausa(1800);
      await t.clicar(todos);
      await pausa(800);
      await t.passo(alvo(page, "arquivos"), "2", "Um cartão por arquivo, agrupado pelo mês", "Em **Agrupar por**, troque para ano ou para nenhum grupo.", 4200);
      const arquivo = cartao(page, /^Extrato do banco/);
      await t.legenda("3", "Clique num arquivo para ver os detalhes");
      await t.focar(null);
      await t.clicar(arquivo);
      await pausa(1200);
      await t.passo(alvo(page, "painel"), "3", "O painel do arquivo", "Quanto bateu, origem, período, lançamentos e com qual arquivo foi conciliado.", 5200);
      const ver = page.getByRole("link", { name: /ver conciliação/i }).first();
      await t.passo(ver, "4", "**Ver conciliação** abre a comparação", "Ou dê um duplo clique no arquivo.", 2600);
      await t.clicar(ver);
      await t.esperar(/\/conciliacoes\/[0-9a-f-]{20,}/);
      await pausa(1600);
    },
  },

  conciliacoes: {
    inicio: "dashboard",
    async cena(t, { page }) {
      await t.passo(null, "", "A sua fila de trabalho", "Um par de folhas por extrato do banco, com as abertas primeiro.", 3600);
      const pedem = botao(page, /^Pedem decisão/);
      await t.passo(grupoDe(pedem), "1", "Filtre a fila", "**Pedem decisão**, **Sem pendência**, **Mês fechado** ou **Todas**.", 2600);
      await t.clicar(botao(page, /^Todas \(/));
      await pausa(1800);
      await t.clicar(pedem);
      await pausa(1000);
      await t.passo(alvo(page, "lista"), "2", "Cada par de folhas é um extrato do banco", "A barra mostra o que bateu e o que diverge; o selo, quantas linhas pedem decisão.", 4800);
      await t.focar(null);
      await t.clicar(botao(page, /^09-setembro-banco/));
      await pausa(1000);
      await t.passo(alvo(page, "previa"), "3", "O resumo da escolhida", "Quanto bate, a situação, as conferidas, a rodada e o mês.", 4800);
      const enviar = botao(page, /enviar nova versão/i);
      await t.passo(enviar, "4", "Corrigiu o sistema de gestão?", "**Enviar nova versão** concilia de novo com o mesmo extrato do banco.", 3800);
      const abrir = page.getByRole("link", { name: /abrir a comparação/i });
      await t.passo(abrir, "5", "**Abrir a comparação** para decidir as linhas", "Ou clique duas vezes na folha.", 2800);
      await t.clicar(abrir);
      await t.esperar(/\/conciliacoes\/[0-9a-f-]{20,}/);
      await pausa(1600);
    },
  },

  comparacao: {
    antes: abrirComparacao,
    async cena(t, { page }) {
      await t.passo(null, "", "O extrato do banco é a fonte da verdade", "É sempre o sistema que diverge do banco.", 3800);
      await t.passo(alvo(page, "resumo"), "1", "O resumo por categoria", "Cada categoria com quantas linhas e quanto valor ficou em aberto.", 4200);
      await t.legenda("1", "Clique numa categoria para ver só as linhas dela");
      await t.clicar(cartao(page, /^Sem correspondência\d/));
      await pausa(2600);
      const todos = botao(page, /^Todos \(/);
      await t.passo(grupoDe(todos), "2", "Filtre as linhas", "**Todos**, **Só revisão** ou **Justificadas**, com quantas há em cada um.", 2400);
      await t.clicar(botao(page, /^Só revisão/));
      await pausa(1800);
      const circulo = botao(page, /como conferida/i);
      await t.passo(circulo, "3", "Marque o que já conferiu", "O círculo da coluna **Conferida** é seu. As linhas que bateram não precisam.", 4200);
      const rodadas = page.getByRole("link", { name: /^Rodada / }).first();
      await t.passo(grupoDe(grupoDe(rodadas)), "4", "Cada versão do sistema vira uma rodada", "A linha das rodadas mostra qual vale.", 3200);
      await t.passo(botao(page, /enviar nova versão/i), "5", "Corrigiu o sistema? **Enviar nova versão**", "A comparação abre na rodada nova.", 3000);
      const linha = linhaParaJustificar(page);
      const painel = alvo(page, "painel");
      await linha.hover();
      await t.passo(painel, "6", "Lançamento em foco", "Passe o mouse sobre uma linha. O detalhe da linha aparece no painel.", 3400);
      await t.legenda("6", "Clique numa linha para fixar", "Clique nela de novo para soltar.");
      await t.clicar(linha.locator("button.celula-abrir").first());
      const explicar = painel.getByRole("button", { name: "Explicar esta divergência" });
      if (await explicar.count()) await t.passo(explicar, "7", "Explicar esta divergência", "Leia o provável motivo e confira no seu sistema de gestão antes de decidir.", 3000);
      const justificar = painel.getByRole("button", { name: "Justificar", exact: true });
      await t.passo(justificar, "8", "Justificar", "Escreva o motivo e clique em **Justificar**.", 2600);
      await t.clicar(justificar);
      await t.passo(painel.getByLabel("Justificativa", { exact: true }), "8", "Justificativa", "Fica no registro com o seu nome e o horário.", 2600);
      await t.clicar(painel.getByRole("button", { name: "Voltar", exact: true }));
      await t.passo(painel.locator(".comp-saldos"), "9", "O saldo do extrato", "Confira o saldo final com o do internet banking. Use **Voltar ao topo do extrato** para voltar ao início.", 3600);
      const detalhe = painel.getByRole("button", { name: "Abrir detalhe" });
      await t.passo(detalhe, "10", "Abrir detalhe", "Clique no botão ou dê um duplo clique na linha. O detalhe abre ao lado, sem sair da comparação.", 3200);
      await t.clicar(detalhe);
    },
  },

  "detalhe-da-linha": {
    antes: async (t) => {
      await abrirComparacao(t);
      await botao(t.page, /^Só revisão/).click();
      await pausa(800);
    },
    async cena(t, { page }) {
      // uma linha ainda sem decisão: a já conferida não oferece Justificar
      const naoConferida = page.locator('button[aria-label*="como conferida"]:not([aria-pressed="true"]):not([aria-checked="true"])');
      const linha = page.locator("main tbody tr").filter({ has: naoConferida }).first();
      await t.passo(linha, "", "Dê um duplo clique numa linha que diverge", "", 2600);
      await t.duplo(linha);
      const painel = page.locator("aside.painel-lateral");
      await painel.waitFor();
      await t.focar(null);
      await pausa(1600);
      await t.passo(painel, "1", "Banco de um lado, sistema do outro", "Data, descrição e valor de cada lado, com a diferença entre os dois.", 5000);
      // sem clicar: com a IA desligada (produção hoje) o texto que volta é o do motor, e o
      // backend-fake devolve outro, que ninguém vê de verdade
      const explicar = painel.getByRole("button", { name: /explicar esta divergência/i });
      if (await explicar.count()) {
        await t.passo(explicar, "2", "O provável motivo", "Clique em **Explicar esta divergência** e confira no seu sistema antes de decidir.", 4200);
      }
      const inteira = painel.getByText(/^abrir em página inteira$/i);
      if (await inteira.count()) await t.passo(inteira, "", "Para ver maior, **Abrir em página inteira**", "No fim do detalhe fica o **Histórico do lançamento**: cada evento, quem fez e quando.", 3800);

      // conferir e justificar são da comparação: o círculo da linha e o painel em foco
      const fechar = painel.getByRole("button", { name: "Fechar" });
      await t.passo(fechar, "3", "Conferir ou justificar", "A decisão é tomada na comparação: feche o detalhe.", 2600);
      await t.clicar(fechar);
      await painel.waitFor({ state: "detached" });
      await pausa(800);
      const circulo = linha.locator('button[aria-label*="como conferida"]');
      await t.passo(circulo, "3", "Conferir ou justificar", "Já olhou e vai corrigir no sistema? O círculo da linha a marca como **conferida**.", 4600);
      const descricao = linha.locator("button.celula-abrir").first();
      await t.passo(descricao, "3", "Conferir ou justificar", "Clique numa linha para fixar.", 3000);
      await t.clicar(descricao);
      const previa = alvo(page, "painel");
      const justificar = previa.getByRole("button", { name: "Justificar", exact: true });
      await t.clicar(justificar);
      const campo = previa.getByLabel("Justificativa", { exact: true });
      await t.passo(campo, "3", "Conferir ou justificar", "Escreva o motivo e clique em **Justificar**.", 2600);
      await t.clicar(campo);
      await page.keyboard.type("Tarifa cobrada no dia seguinte", { delay: 60 });
      await pausa(800);
      await t.clicar(justificar);
      const nota = previa.locator(".comp-nota");
      await nota.waitFor();
      await pausa(600);
      await t.passo(nota, "3", "A decisão vai para o relatório do mês", "", 4600);
    },
  },

  fechamentos: {
    inicio: "fechamentos",
    async cena(t, { page }) {
      await t.passo(null, "", "Onde você fecha o mês", "Depois de conciliar e decidir as divergências.", 3400);
      await t.passo(alvo(page, "meses"), "1", "Um cartão por mês", "A cor e a porcentagem mostram quanto já bateu; o selo, se está com pendência ou fechado.", 4600);
      await t.focar(null);
      await t.clicar(cartao(page, /^Competência\s*Outubro/));
      await pausa(1000);
      await t.passo(alvo(page, "painel"), "2", "O que falta para fechar", "**Extratos conciliados**, **Arquivos lidos por inteiro** e **Divergências decididas**.", 5200);
      const revisar = page.getByRole("link", { name: /revisar pendências/i });
      await t.passo(revisar, "3", "**Revisar pendências** leva até elas", "Com tudo pronto, o mês fecha num clique em **Fechar o mês**.", 4200);
      await t.focar(null);
      await t.legenda("4", "Um mês fechado tem o relatório para o contador");
      await t.clicar(botao(page, /^Fechados/));
      await pausa(1200);
      await t.clicar(cartao(page, /^Competência\s*Agosto/));
      await pausa(1200);
      await t.passo(alvo(page, "painel").getByText(/^Baixar PDF$/), "4", "**Baixar PDF** ou **Exportar CSV**", "O resumo do mês e como cada divergência foi resolvida.", 4200);
      const reabrir = botao(page, /^reabrir/i);
      if (await reabrir.count()) await t.passo(reabrir, "5", "Precisa mexer de novo? **Reabrir** o mês", "Só o administrador e o gestor fecham e reabrem.", 3800);
    },
  },

  historico: {
    inicio: "historico",
    async cena(t, { page }) {
      await t.passo(alvo(page, "grafico"), "1", "Como os meses andaram", "Quanto bateu em cada mês.", 4200);
      const todas = botao(page, /^Todas \(/);
      await t.passo(grupoDe(todas), "2", "Filtre por **Todas** ou **Com pendência**", "", 2800);
      await t.passo(alvo(page, "lista"), "3", "Um par de folhas por conciliação", "Agrupadas pelo mês do extrato do banco, com quanto bateu e as rodadas.", 4200);
      await t.focar(null);
      await t.clicar(botao(page, /^08-agosto-banco/));
      await pausa(1000);
      await t.passo(alvo(page, "previa"), "4", "As rodadas da escolhida", "A que **Vale**, as anteriores com **Ver**, e as substituídas.", 5200);
      await t.passo(botao(page, /exportar histórico/i), "5", "**Exportar histórico** leva tudo para uma planilha", "", 3400);
    },
  },

  empresas: {
    inicio: "empresas",
    async cena(t, { page }) {
      await t.passo(alvo(page, "lista"), "1", "As empresas da sua conta", "Com o CNPJ e a situação do mês. Procure pela razão social ou pelo CNPJ.", 4600);
      await t.focar(null);
      await t.clicar(botao(page, /^Construtora Horizonte/));
      await pausa(1000);
      await t.passo(alvo(page, "previa"), "2", "Clique numa empresa para ver os detalhes", "**Abrir esta empresa** leva à Visão geral dela.", 4600);
      const adicionar = botao(page, /^adicionar empresa$/i);
      await t.passo(adicionar, "3", "**Adicionar empresa**, pelo CNPJ", "Só o administrador e o gestor cadastram.", 2600);
      await t.clicar(adicionar);
      await pausa(3000);
      await page.keyboard.press("Escape");
      await pausa(800);
      const equipe = botao(page, /^Equipe \(/);
      await t.passo(equipe, "4", "Em **Equipe**, as pessoas da conta", "E o papel de cada uma: administrador, gestor ou analista.", 2400);
      await t.clicar(equipe);
      await pausa(1200);
      await t.clicar(botao(page, /^Gabriela Gestora/));
      await pausa(1000);
      await t.passo(alvo(page, "pessoa"), "5", "O papel explicado, e o que dá para fazer", "Só o administrador troca papéis e remove pessoas.", 4800);
      await t.passo(botao(page, /^convidar pessoa$/i), "6", "**Convidar pessoa**: o e-mail e o papel", "A pessoa recebe um link para criar o acesso.", 3800);
    },
  },

  configuracoes: {
    inicio: "visao-geral",
    async cena(t, { page }) {
      await t.legenda("1", "Aperte **Ctrl** e **,**", "Ou clique no seu nome no menu lateral e em **Configurações**.");
      await pausa(2600);
      await page.keyboard.press("Control+Comma");
      const janela = page.getByRole("dialog", { name: /configurações/i });
      await janela.waitFor();
      await pausa(1200);
      const secao = (nome) => janela.getByRole("button", { name: nome }).first();
      await t.passo(grupoDe(grupoDe(secao(/^Conta$/))), "2", "As seções ficam à esquerda", "Conta, Aparência, Conciliação, API, Atalhos, Privacidade e Sobre.", 4200);
      await t.focar(null);
      await t.legenda("3", "**Conta**: o e-mail e a senha", "Trocar senha e Trocar e-mail ficam aqui.");
      await t.clicar(secao(/^Conta$/));
      await pausa(3600);
      const procurar = janela.getByLabel(/procurar nas configurações/i);
      await t.legenda("4", "Ou procure o que quer mudar");
      await t.clicar(procurar);
      await page.keyboard.type("senha", { delay: 140 });
      await pausa(2800);
      await procurar.fill("");
      await t.legenda("5", "**Conciliação**: a tolerância de data", "Até quantos dias de diferença ainda contam como bateu. Vale a partir da próxima conciliação.");
      await t.clicar(secao(/^Conciliação$/));
      await pausa(5200);
      await t.legenda("6", "**Aparência**: tema, densidade e menu lateral");
      await t.clicar(secao(/^Aparência$/));
      await pausa(3800);
    },
  },

  "nova-conciliacao": {
    inicio: "visao-geral",
    async cena(t, { page }) {
      const menu = page.getByRole("link", { name: /nova concilia/i }).first();
      await t.passo(menu, "", "Abra **Nova conciliação** no menu lateral", "", 1500);
      await t.clicar(menu);
      await t.focar(null);
      await t.esperar(/conciliacoes\/nova/);
      await t.passo(alvo(page, "encaixe"), "", "Você envia o extrato do banco e o do sistema de gestão, do mesmo período", "O Ledgr compara os dois linha por linha.", 4200);
      const banco = page.locator('input[aria-label="Extrato do banco"]');
      const cartaoBanco = banco.locator("xpath=..");
      await t.passo(cartaoBanco, "1", "Envie o extrato do banco", "**OFX ou CSV** exportado do internet banking, até 4 MB.", 1800);
      await t.clicar(cartaoBanco).catch(() => {});
      await banco.setInputFiles(path.join(AQUI, "banco-dezembro-2025.csv"));
      await pausa(2600);
      const sistema = page.locator('input[aria-label="Extrato do sistema de gestão"]');
      const cartaoSistema = sistema.locator("xpath=..");
      await t.passo(cartaoSistema, "2", "Envie o extrato do sistema de gestão", "Um **CSV** com data, descrição e valor, do mesmo mês.", 1800);
      await t.clicar(cartaoSistema).catch(() => {});
      await sistema.setInputFiles(path.join(AQUI, "erp-dezembro-2025.csv"));
      await pausa(2600);
      const conciliar = page.getByRole("button", { name: /conciliar extratos/i });
      await t.passo(conciliar, "3", "Clique em **Conciliar extratos**", "O botão libera quando os dois arquivos estão no lugar.", 1800);
      await t.focar(null);
      await t.legenda("", "O Ledgr está lendo e comparando os dois arquivos…");
      await t.clicar(conciliar);
      await t.esperar(/\/conciliacoes\/[0-9a-f-]{20,}/);
      await t.passo(null, "", "Pronto: a comparação abre sozinha", "O que bateu fica de um lado; o que diverge, para você revisar.", 3500);
      await t.passo(alvo(page, "resumo"), "", "O resumo mostra as divergências por categoria", "Clique numa categoria para ver só as linhas dela.", 5000);
    },
  },
};

// --figuras: a figura de cada seção da página da Central (FiguraDaTela), no lugar das capturas .webp. Uma tomada
// prepara a tela (antes) e marca o que cada figura mostra (alvo, um ou mais elementos: a figura é a caixa que
// cobre todos); pad é a folga em volta, max corta uma lista comprida. altura: a da janela, para o painel caber
// inteiro sem rolar (na réplica ele fica estático, com a altura toda).
const janelaDeConfiguracoes = (page) => page.getByRole("dialog", { name: /configurações/i });
const secaoDeConfiguracoes = (page, nome) => janelaDeConfiguracoes(page).getByRole("button", { name: nome }).first();
const abrirConciliacaoDe = async (t, banco) => {
  await t.abrir("dashboard");
  await botao(t.page, /^Todas \(/).click();
  await pausa(600);
  await cartao(t.page, banco).click();
  await pausa(600);
  await t.page.getByRole("link", { name: /abrir a comparação/i }).first().click();
  await t.esperar(/\/conciliacoes\/[0-9a-f-]{20,}/);
};
const FIGURAS = {
  "visao-geral": {
    inicio: "visao-geral",
    tomadas: [{ figuras: [{ id: "estado-do-mes", alvo: (p) => alvo(p, "estado-do-mes") }, { id: "atalhos", alvo: (p) => alvo(p, "atalhos") }] }],
  },
  extratos: {
    inicio: "extratos",
    tomadas: [
      { figuras: [{ id: "filtros", alvo: (p) => alvo(p, "filtros") }, { id: "arquivos", alvo: (p) => alvo(p, "arquivos"), max: 600 }] },
      {
        altura: 1000,
        antes: async ({ page }) => {
          await cartao(page, /^Extrato do banco/).click();
          await pausa(1200);
        },
        figuras: [{ id: "painel", alvo: (p) => alvo(p, "painel") }],
      },
    ],
  },
  conciliacoes: { inicio: "dashboard", tomadas: [{ figuras: [{ id: "filtros", alvo: (p) => alvo(p, "filtros") }] }] },
  "nova-conciliacao": {
    inicio: "conciliacoes/nova",
    tomadas: [
      { figuras: [{ id: "enviar", alvo: (p) => alvo(p, "encaixe") }] },
      // o botão como o texto diz: livre, com os dois arquivos no lugar (só escolher não envia nada)
      {
        antes: async ({ page }) => {
          await page.locator('input[aria-label="Extrato do banco"]').setInputFiles(path.join(AQUI, "banco-dezembro-2025.csv"));
          await page.locator('input[aria-label="Extrato do sistema de gestão"]').setInputFiles(path.join(AQUI, "erp-dezembro-2025.csv"));
          await pausa(1500);
        },
        figuras: [{ id: "conciliar", alvo: (p) => alvo(p, "conciliar") }],
      },
    ],
  },
  comparacao: {
    antes: abrirComparacao,
    tomadas: [
      {
        figuras: [
          { id: "resumo", alvo: (p) => alvo(p, "resumo") },
          { id: "filtros", alvo: (p) => alvo(p, "filtros") },
          { id: "rodadas", alvo: (p) => p.locator("nav.rodadas-linha"), pad: 10 },
        ],
      },
      {
        antes: async ({ page }) => {
          await botao(page, /^Só revisão/).click();
          await pausa(800);
        },
        // a coluna Conferida nas linhas que pedem revisão: uma já conferida, a outra não
        figuras: [{ id: "conferir", alvo: (p) => [p.locator("main table thead").first(), p.locator("main tbody tr")] }],
      },
      {
        antes: async ({ page }) => {
          await linhaParaJustificar(page).locator("button.celula-abrir").first().click();
        },
        figuras: [{ id: "painel", alvo: (p) => alvo(p, "painel") }],
      },
      {
        antes: async ({ page }) => {
          await alvo(page, "painel").getByRole("button", { name: "Justificar", exact: true }).click();
        },
        figuras: [{ id: "justificar", alvo: (p) => alvo(p, "painel").locator(".comp-foco") }],
      },
      { antes: (t) => abrirConciliacaoDe(t, /^08-agosto-banco/), figuras: [{ id: "mes-fechado", alvo: (p) => p.locator(".mes-fechado-aviso"), pad: 8 }] },
    ],
  },
  "detalhe-da-linha": {
    tomadas: [
      {
        // setembro tem a divergência de valor com os dois lados; o detalhe abre ao lado, no duplo clique
        antes: async (t) => {
          await abrirConciliacaoDe(t, /^09-setembro-banco/);
          await t.page.locator('main tbody tr[data-situacao="a_conferir"]').filter({ hasText: "Valor diverge" }).first().dblclick();
          await t.page.locator("aside.painel-lateral").waitFor();
          await pausa(1500);
        },
        figuras: [{ id: "lados", alvo: (p) => p.locator("aside.painel-lateral [data-tutorial=lados]") }],
      },
      { figuras: [{ id: "motivo", alvo: (p) => p.locator("aside.painel-lateral .det-causa") }] },
    ],
  },
  fechamentos: {
    inicio: "fechamentos",
    tomadas: [
      { figuras: [{ id: "meses", alvo: (p) => alvo(p, "meses"), max: 640 }] },
      {
        altura: 1000,
        antes: async ({ page }) => {
          await cartao(page, /^Competência\s*Outubro/).click();
          await pausa(1200);
        },
        figuras: [{ id: "o-que-falta", alvo: (p) => alvo(p, "painel") }],
      },
      {
        altura: 1000,
        antes: async ({ page }) => {
          await botao(page, /^Fechados/).click();
          await pausa(1200);
          await cartao(page, /^Competência\s*Agosto/).click();
          await pausa(1200);
        },
        figuras: [
          { id: "reabrir", alvo: (p) => alvo(p, "painel") },
          { id: "relatorio", alvo: (p) => alvo(p, "painel").locator(".fech-passo").filter({ hasText: "Relatório para o contador" }), pad: 10 },
        ],
      },
    ],
  },
  historico: { inicio: "historico", tomadas: [{ figuras: [{ id: "grafico", alvo: (p) => alvo(p, "grafico") }] }] },
  empresas: {
    inicio: "empresas",
    tomadas: [
      {
        antes: async ({ page }) => {
          await botao(page, /^Equipe \(/).click();
          await pausa(1200);
          await botao(page, /^Gabriela Gestora/).click();
          await pausa(1000);
        },
        figuras: [{ id: "equipe", alvo: (p) => [alvo(p, "equipe"), alvo(p, "pessoa")] }],
      },
    ],
  },
  configuracoes: {
    inicio: "visao-geral",
    tomadas: [
      {
        antes: async ({ page }) => {
          await page.keyboard.press("Control+Comma");
          await janelaDeConfiguracoes(page).waitFor();
          await secaoDeConfiguracoes(page, /^Conta$/).click();
          await pausa(1200);
        },
        figuras: [{ id: "conta", alvo: janelaDeConfiguracoes, pad: 0 }],
      },
      {
        antes: async ({ page }) => {
          await secaoDeConfiguracoes(page, /^Conciliação$/).click();
          await pausa(1200);
        },
        figuras: [{ id: "tolerancia", alvo: janelaDeConfiguracoes, pad: 0 }],
      },
      {
        antes: async ({ page }) => {
          await secaoDeConfiguracoes(page, /^Aparência$/).click();
          await pausa(1200);
        },
        figuras: [{ id: "aparencia", alvo: janelaDeConfiguracoes, pad: 0 }],
      },
    ],
  },
};

async function fotografar(page, t, receita, tela) {
  const cenas = [];
  const camadas = [];
  const figuras = {};
  // a mesma cena (ou janela) em duas tomadas vai uma vez só
  const indice = (lista, html) => (lista.includes(html) ? lista.indexOf(html) : lista.push(html) - 1);
  let primeira = null;
  for (const tomada of receita.tomadas) {
    const alturaDaTela = tomada.altura ?? 800;
    await page.setViewportSize({ width: 1280, height: alturaDaTela });
    if (tomada.antes) await tomada.antes(t);
    await pausa(500);
    for (const f of tomada.figuras) {
      const alvos = [f.alvo(page)].flat();
      await alvos[0].first().scrollIntoViewIfNeeded();
      for (const a of alvos) await a.evaluateAll((es, id) => es.forEach((e) => e.setAttribute("data-figura", id)), f.id);
    }
    // a caixa de cada figura, na tela do app: o player mede de novo na réplica, esta só reserva o espaço
    const caixas = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
      const rs = [...document.querySelectorAll(`[data-figura="${id}"]`)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
      if (!rs.length) return [id, null];
      const x = Math.min(...rs.map((r) => r.left));
      const y = Math.min(...rs.map((r) => r.top));
      return [id, { w: Math.max(...rs.map((r) => r.right)) - x, h: Math.max(...rs.map((r) => r.bottom)) - y }];
    })), tomada.figuras.map((f) => f.id));
    const lido = await lerTela(page);
    await page.evaluate(() => document.querySelectorAll("[data-figura]").forEach((e) => e.removeAttribute("data-figura")));
    primeira ??= lido;
    const cena = indice(cenas, lido.html);
    const camada = lido.camada ? indice(camadas, lido.camada) : null;
    for (const f of tomada.figuras) {
      const caixa = caixas[f.id];
      if (!caixa) throw new Error(`figura sem alvo: ${f.id}`);
      const pad = f.pad ?? 12;
      figuras[f.id] = {
        cena,
        camada,
        menu: lido.menu,
        alturaDaTela,
        pad,
        largura: Math.round(caixa.w + 2 * pad),
        altura: Math.round(Math.min(caixa.h, f.max ?? Infinity) + 2 * pad),
      };
    }
  }
  const saida = path.join(PUBLICO, `${tela}--figuras.json`);
  fs.writeFileSync(saida, JSON.stringify({ barra: primeira.barra, conta: primeira.conta, cenas, camadas, figuras }));
  return {
    kb: Math.round(fs.statSync(saida).size / 1024),
    figuras: Object.fromEntries(Object.entries(figuras).map(([id, f]) => [id, `${f.largura}x${f.altura}`])),
  };
}

async function gravar(browser, estado, empresa, tela) {
  const roteiro = FIGURAS_ ? FIGURAS[tela] : ROTEIROS[tela];
  const ctx = await browser.newContext({
    // a janela do player (1280 × 800): a tela capturada não muda de leiaute nele; os números animados já no valor
    // final e nenhuma transição no meio da captura
    viewport: { width: 1280, height: 800 },
    storageState: estado,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  // sem os tutoriais do mascote e sem o roteiro de primeiros passos por cima
  await ctx.addInitScript(() => localStorage.setItem("ledgr:preferencias", JSON.stringify({ tutoriaisDispensados: ["visao-geral","conciliacoes","nova-conciliacao","comparacao","divergencia","extratos","historico","fechamentos","configuracoes"], roteiroDispensado: true })));
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const t = ferramentas(page, empresa);
  if (roteiro.inicio) await t.abrir(roteiro.inicio);
  if (roteiro.antes) await roteiro.antes(t);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(700, 500);
  const feito = await (FIGURAS_ ? fotografar(page, t, roteiro, tela) : capturar(page, t, roteiro, tela));
  await ctx.close();
  return feito;
}

// o #conteudo da tela como está agora, em HTML estático, e o que o app põe por cima dele (as janelas abertas, o painel
// da linha), a barra do topo, o item do menu e a conta
const lerTela = (page) =>
  page
    .evaluate(() => {
      const conteudo = document.querySelector("#conteudo");
      if (!conteudo) return null;
      // o que fica por cima da página vai à parte: as janelas abertas e o que o app prende na tela (o painel da linha)
      const fixos = [...conteudo.querySelectorAll("*")].filter(
        (e) => getComputedStyle(e).position === "fixed" && e.getClientRects().length && !e.closest("dialog"),
      );
      const camadas = [...document.querySelectorAll("dialog[open]"), ...fixos.filter((e) => !fixos.some((f) => f !== e && f.contains(e)))];
      for (const e of camadas) e.setAttribute("data-camada", "");
      // a cópia estática: o que foi digitado vira atributo, a rolagem de dentro vai em data-rolagem, a janela fica no
      // lugar e no tamanho em que estava na tela de 1280 × 800, e sem endereços do app nem o id do #conteudo
      const limpar = (e) => {
        if (!e) return "";
        const originais = [e, ...e.querySelectorAll("*")];
        const copia = e.cloneNode(true);
        const copias = [copia, ...copia.querySelectorAll("*")];
        originais.forEach((o, i) => {
          const c = copias[i];
          if (o.scrollTop > 0) c.setAttribute("data-rolagem", String(Math.round(o.scrollTop)));
          if (o instanceof HTMLInputElement) {
            if (o.type === "checkbox" || o.type === "radio") c.toggleAttribute("checked", o.checked);
            else if (o.type !== "file") c.setAttribute("value", o.value);
          } else if (o instanceof HTMLTextAreaElement) c.textContent = o.value;
          else if (o instanceof HTMLSelectElement) [...c.options].forEach((op, j) => op.toggleAttribute("selected", j === o.selectedIndex));
          else if (o instanceof HTMLDialogElement) {
            const r = o.getBoundingClientRect();
            c.setAttribute("style", `position:absolute;inset:auto;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;max-width:none;max-height:none`);
            if (o.matches(":modal")) c.setAttribute("data-modal", "");
          }
          if (o.matches(".comparacao-grade[data-painel]")) {
            c.style.setProperty("--comp-largura-painel", `${o.querySelector(".comp-painel").offsetWidth}px`);
          }
          if (o.matches(".comp-painel")) c.style.maxHeight = getComputedStyle(o).maxHeight;
        });
        for (const x of copia.querySelectorAll("[data-camada]")) x.remove();
        for (const a of copia.querySelectorAll("[href]")) a.removeAttribute("href");
        for (const nome of ["id", "tabindex", "data-camada"]) copia.removeAttribute(nome);
        return copia.outerHTML;
      };
      const texto = (seletor) => document.querySelector(seletor)?.textContent.trim();
      const lido = {
        html: limpar(conteudo),
        camada: camadas.map(limpar).join(""),
        menu: texto('.app-aside a[aria-current="page"]'),
        barra: limpar(document.querySelector(".app-topo")),
        conta: { nome: texto(".app-conta-nome"), empresa: texto(".app-conta-empresa"), iniciais: texto(".app-conta-iniciais") },
      };
      for (const e of camadas) e.removeAttribute("data-camada");
      return lido;
    })
    .catch(() => null); // no meio de uma navegação

// A demonstração: o #conteudo de cada passo, com o alvo marcado (data-passo), a legenda e o tempo
// desde o começo; o player toca no mesmo ritmo. Um passo que não mudou a tela reaproveita a cena anterior.
async function capturar(page, t, roteiro, tela) {
  const cenas = [];
  const camadas = [];
  const passos = [];
  const t0 = Date.now();
  let semMarcas = null;
  let marcas = 0;
  let fala = {};
  let foco = null;
  const ler = () => lerTela(page);
  // um alvo no menu lateral vai pelo nome do item ("menu:<nome>"): o menu do player é o da vitrine, não uma cópia
  const marcar = async (loc) => {
    const id = marcas++;
    const noMenu = await loc.evaluate((e, id) => {
      // a janela de Configurações mora dentro do menu lateral: o que está numa janela é capturado com ela
      if (e.closest(".app-aside") && !e.closest("dialog")) return e.textContent.trim();
      e.setAttribute("data-passo", id);
      return null;
    }, String(id));
    return noMenu ? `menu:${noMenu}` : id;
  };
  let primeira = null;
  const guardar = async (extra = {}) => {
    // o mouse sai de cima da página: um cartão de hover aberto pelo caminho não é parte da explicação
    await page.mouse.move(1, 1);
    const lido = await ler();
    if (!lido) return;
    primeira ??= lido;
    const { html, camada, menu } = lido;
    const tudo = html + camada;
    const tem = (m) => typeof m === "string" || tudo.includes(`data-passo="${m}"`);
    const limpo = tudo.replace(/ data-passo="\d+"/g, "");
    const ultima = cenas.length - 1;
    const usadas = passos.filter((p) => p.cena === ultima).flatMap((p) => [p.foco, p.cursor]).filter((m) => m != null);
    if (limpo === semMarcas && usadas.every(tem)) {
      cenas[ultima] = html;
      camadas[ultima] = camada;
    } else {
      cenas.push(html);
      camadas.push(camada);
    }
    semMarcas = limpo;
    // o destaque de um passo anterior que sumiu da tela nova não vai junto
    passos.push({ t: Date.now() - t0, cena: cenas.length - 1, menu, ...fala, ...(foco != null && tem(foco) && { foco }), ...extra });
  };

  t.focar = async (loc) => {
    foco = loc ? await marcar(loc) : null;
  };
  t.legenda = async (n, texto, detalhe) => {
    fala = { n, texto, detalhe };
    await guardar();
  };
  t.passo = async (loc, n, texto, detalhe, ms = 4200) => {
    fala = { n, texto, detalhe };
    await t.focar(loc);
    await guardar();
    await pausa(ms);
  };
  // o que foi digitado aparece na tela antes de o roteiro seguir (na busca de Configurações, ele limpa logo depois)
  const digitar = page.keyboard.type.bind(page.keyboard);
  page.keyboard.type = async (...args) => {
    await digitar(...args);
    await guardar();
  };
  // o cursor do player leva 1 s até o alvo; o clique acontece quando ele chega
  for (const [nome, cliques] of [["clicar", 1], ["duplo", 2]]) {
    t[nome] = async (loc) => {
      await guardar({ cursor: await marcar(loc), clique: cliques });
      await pausa(1000);
      await (cliques === 2 ? loc.dblclick() : loc.click());
      await pausa(400);
      await guardar();
    };
  }

  await roteiro.cena(t, { page });
  const saida = path.join(PUBLICO, `${tela}.json`);
  fs.writeFileSync(saida, JSON.stringify({ barra: primeira.barra, conta: primeira.conta, cenas, camadas, passos, fim: Date.now() - t0 }));
  return { saida, cenas: cenas.length, passos: passos.length, kb: Math.round(fs.statSync(saida).size / 1024) };
}

async function main() {
  const pedidas = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const mapa = FIGURAS_ ? FIGURAS : ROTEIROS;
  const telas = pedidas.length ? pedidas : Object.keys(mapa);
  for (const tela of telas) if (!mapa[tela]) throw new Error(`tela sem roteiro: ${tela}`);
  const browser = await chromium.launch({ channel: "chrome" });

  // entrar antes de gravar: a captura começa já dentro do app
  const login = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pl = await login.newPage();
  await pl.goto(`${BASE}/login`);
  await pl.getByLabel(/e-?mail/i).first().fill(EMAIL);
  await pl.getByLabel(/^senha$/i).fill(SENHA);
  await pl.getByRole("button", { name: /^entrar$/i }).click();
  await pl.waitForURL(/\/e\/[0-9a-f-]+\//, { timeout: 30000 });
  const empresa = pl.url().match(/\/e\/([0-9a-f-]+)\//)[1];
  const estado = await login.storageState();
  await login.close();

  for (const tela of telas) {
    try {
      console.log(tela, await gravar(browser, estado, empresa, tela));
    } catch (e) {
      console.error(tela, "FALHOU:", e.message.split("\n").slice(0, 4).join(" / "), e.stack.split("\n").find((l) => l.includes("gravar.mjs")));
      process.exitCode = 1;
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
