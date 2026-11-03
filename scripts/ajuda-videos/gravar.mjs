// Grava os vídeos-tutoriais da Central de ajuda (#199): app local + legendas, destaque e cursor desenhados na página.
// Um roteiro por tela, em ROTEIROS, com os textos da página dela em app/(ajuda)/ajuda/paginas.ts.
//
// Como rodar (Windows, Git Bash), com o backend-fake em :8000 (npm run backend-fake, conta Telha Certa) e o
// front de produção local em :3950 (npm run build e npx next start -p 3950, com LEDGR_API_URL=http://localhost:8000
// e AUTH_TRUST_HOST=true no .env.local):
//   npm i --no-save playwright-core && npx playwright-core install ffmpeg
//   FFMPEG=<%LOCALAPPDATA%/ms-playwright/ffmpeg-*/ffmpeg-win64.exe> node scripts/ajuda-videos/gravar.mjs visao-geral extratos ...
// Sem tela, grava todas. Cada vídeo sai em public/ajuda/<tela>.webm; ligue-o no campo video da página.
// A Nova conciliação ENVIA os CSVs de verdade: grave-a por último, e com o backend-fake recém-subido
// (ou troque o mês dos CSVs), senão a conciliação repete.
import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:3950";
// a conta de teste do backend-fake
const EMAIL = process.env.EMAIL ?? "financeiro@telhacerta.com.br";
const SENHA = process.env.SENHA ?? "ledgr2026";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(AQUI, "..", "..", "public", "ajuda");
const SAIDA = process.env.SAIDA ?? path.join(os.tmpdir(), "ledgr-ajuda-videos");
const LARGURA = 1360;
const ALTURA = 850;
const FPS = 30;
const ESCALA = 2; // pixels reais por pixel da página: texto nítido
const FFMPEG = process.env.FFMPEG; // o ffmpeg que vem com o Playwright
fs.mkdirSync(SAIDA, { recursive: true });

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
// **negrito** dos textos da ajuda vira destaque na legenda
const marcar = (s) => s && s.replace(/\*\*(.+?)\*\*/g, "<em>$1</em>");

// o que fica desenhado por cima do app: legenda embaixo, destaque no elemento, cursor
function OVERLAY() {
  if (window.__v) return;
  if (!document.documentElement) return void new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); OVERLAY(); } }).observe(document, { childList: true });
  const css = document.createElement("style");
  css.textContent = `
    [data-tutorial]{scroll-margin-top:100px}
    #v-legenda,#v-foco,#v-cursor,#v-capa,.v-onda{inset:auto;margin:0;border:0;padding:0;overflow:visible;background:none;color:inherit}
    #v-legenda{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);z-index:2147483646;max-width:880px;
      background:rgba(32,31,29,.94);color:#f3f2f2;border-radius:16px;padding:16px 26px;opacity:0;
      font:500 18px/1.4 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);
      transition:opacity .35s,transform .35s;display:flex;gap:16px;align-items:center;pointer-events:none}
    #v-legenda.on{opacity:1;transform:translate(-50%,0)}
    #v-legenda b{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;
      background:#b68235;color:#fff;font:700 17px Inter,system-ui,sans-serif}
    #v-legenda em{font-style:normal;font-weight:600;color:#e0b878}
    #v-legenda small{display:block;font-weight:400;font-size:15px;opacity:.78;margin-top:2px}
    #v-foco{position:fixed;z-index:2147483645;border-radius:14px;pointer-events:none;opacity:0;
      box-shadow:0 0 0 9999px rgba(20,18,16,.5),0 0 0 3px #b68235;transition:all .4s ease}
    #v-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;pointer-events:none;
      transform:translate(-100px,-100px);transition:transform .05s linear}
    #v-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
    .v-onda{position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px;border-radius:50%;
      border:3px solid #b68235;pointer-events:none;animation:v-onda .6s ease-out forwards}
    @keyframes v-onda{to{transform:scale(4);opacity:0}}
    #v-capa{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;text-align:center;
      background:#201f1d;color:#f3f2f2;opacity:0;pointer-events:none;transition:opacity .5s}
    #v-capa.on{opacity:1}
    #v-capa h1{font:600 54px/1.1 Newsreader,Georgia,serif;margin:0 0 14px}
    #v-capa p{font:400 21px Inter,system-ui,sans-serif;opacity:.75;margin:0}
  `;
  document.documentElement.append(css);
  // em popover, para ficar na camada de cima como o <dialog> das janelas do app; sem isso a legenda
  // fica atrás do fundo desfocado de uma janela aberta
  const mk = (id, html = "", tag = "div") => {
    const e = document.createElement(tag);
    if (id) e.id = id;
    e.innerHTML = html;
    e.popover = "manual";
    document.documentElement.append(e);
    e.showPopover();
    return e;
  };
  // uma janela que abre depois do overlay passa por cima dele: o overlay sobe de novo, uma vez por janela
  let janelaDeCima = null;
  const subir = () => {
    const janela = [...document.querySelectorAll("dialog[open]")].at(-1) ?? null;
    if (janela === janelaDeCima) return;
    janelaDeCima = janela;
    if (janela) for (const e of [foco, legenda, capa, cursor]) { e.hidePopover(); e.showPopover(); }
  };
  const legenda = mk("v-legenda");
  const foco = mk("v-foco");
  const cursor = mk(
    "v-cursor",
    '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#201f1d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  );
  const capa = mk("v-capa");
  window.__v = {
    legenda(passo, texto, detalhe) {
      subir();
      if (!texto) return void legenda.classList.remove("on");
      legenda.innerHTML = (passo ? `<b>${passo}</b>` : "") + `<div>${texto}${detalhe ? `<small>${detalhe}</small>` : ""}</div>`;
      legenda.classList.add("on");
    },
    foco(r) {
      subir();
      if (!r) return void (foco.style.opacity = 0);
      const m = 8;
      Object.assign(foco.style, {
        opacity: 1,
        left: r.x - m + "px",
        top: r.y - m + "px",
        width: r.width + 2 * m + "px",
        height: r.height + 2 * m + "px",
      });
    },
    capa(titulo, sub) {
      if (!titulo) return void capa.classList.remove("on");
      capa.innerHTML = `<div><h1>${titulo}</h1><p>${sub}</p></div>`;
      capa.classList.add("on");
    },
    onda(x, y) {
      subir();
      const o = mk("");
      o.className = "v-onda";
      o.style.left = x + "px";
      o.style.top = y + "px";
      setTimeout(() => o.remove(), 700);
    },
  };
  addEventListener("mousemove", (e) => (cursor.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`), true);
};

// o que cada roteiro usa: legenda, destaque, cursor com marca de clique e navegação dentro da empresa
function ferramentas(page, empresa) {
  const v = (fn, ...args) => page.evaluate(([f, a]) => window.__v[f](...a), [fn, args]);
  // o destaque não passa da tela: um painel mais alto que ela rola até o começo, logo abaixo da barra
  // do topo (scroll-margin-top do OVERLAY), e ganha só a parte visível
  const caixa = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    let r = await loc.boundingBox();
    const alto = r.height > ALTURA * 0.6;
    if (alto) await loc.evaluate((e) => e.scrollIntoView({ block: "start", behavior: "smooth" }));
    await pausa(alto ? 700 : 300);
    r = await loc.boundingBox();
    const y = Math.max(r.y, alto ? 90 : 12);
    return { x: r.x, y, width: r.width, height: Math.min(r.y + r.height, ALTURA - 12) - y };
  };
  let cursorEm = { x: 700, y: 500 };
  const ir = async (loc) => {
    const r = await caixa(loc);
    // passo a passo, com pausa: o cursor precisa de quadros no caminho para não "teletransportar"
    const alvo = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    const de = cursorEm;
    const passos = 45;
    for (let i = 1; i <= passos; i++) {
      const e = 0.5 - Math.cos((i / passos) * Math.PI) / 2; // começa e termina devagar
      await page.mouse.move(de.x + (alvo.x - de.x) * e, de.y + (alvo.y - de.y) * e);
      await pausa(16);
    }
    cursorEm = alvo;
    await v("onda", alvo.x, alvo.y);
    await pausa(250);
  };
  const t = {
    page,
    v,
    legenda: (passo, texto, detalhe) => v("legenda", passo, marcar(texto), marcar(detalhe)),
    focar: async (loc) => v("foco", loc ? await caixa(loc) : null),
    clicar: async (loc) => {
      await ir(loc);
      await loc.click();
    },
    duplo: async (loc) => {
      await ir(loc);
      await loc.dblclick();
    },
    abrir: async (tela) => {
      await page.goto(`${BASE}/e/${empresa}/${tela}`);
      await page.waitForLoadState("networkidle");
    },
    esperar: async (padrao) => {
      await page.waitForURL(padrao, { timeout: 90000 });
      await page.waitForLoadState("networkidle");
      await pausa(800);
    },
    // um passo do roteiro: legenda, destaque no que ela fala e tempo para ler
    passo: async (loc, n, texto, detalhe, ms = 4200) => {
      await t.legenda(n, texto, detalhe);
      await t.focar(loc);
      await pausa(ms);
    },
    soltar: async () => {
      await v("foco");
      await v("legenda");
    },
  };
  return t;
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

// inicio: a tela em que o vídeo começa; antes: o que roda antes da gravação; cena: o vídeo
const ROTEIROS = {
  "visao-geral": {
    titulo: "Visão geral",
    sub: "Como está o mês e o que pede sua atenção",
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
    fim: ["Visão geral", "O ponto de partida de cada dia"],
  },

  extratos: {
    titulo: "Extratos",
    sub: "Todos os arquivos que você enviou",
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
    fim: ["Extratos", "Cada arquivo e o que aconteceu com ele"],
  },

  conciliacoes: {
    titulo: "Conciliações",
    sub: "A sua fila de trabalho",
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
    fim: ["Conciliações", "Continue de onde parou"],
  },

  comparacao: {
    titulo: "Comparação",
    sub: "O banco e o sistema lado a lado",
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
      await t.passo(page.locator("main tbody tr").first(), "4", "Dê um duplo clique numa linha para abrir o detalhe", "Ele abre ao lado, sem sair da comparação.", 3600);
      const rodadas = page.getByRole("link", { name: /^Rodada / }).first();
      await t.passo(grupoDe(grupoDe(rodadas)), "5", "Cada versão do sistema vira uma rodada", "A linha das rodadas mostra qual vale.", 4000);
      await t.passo(botao(page, /enviar nova versão/i), "6", "Corrigiu o sistema? **Enviar nova versão**", "A comparação abre na rodada nova.", 3800);
    },
    fim: ["Comparação", "Revise o que não bateu"],
  },

  "detalhe-da-linha": {
    titulo: "Detalhe da linha",
    sub: "Uma divergência de perto",
    antes: async (t) => {
      await abrirComparacao(t);
      await botao(t.page, /^Só revisão/).click();
      await pausa(800);
    },
    async cena(t, { page }) {
      const linha = page.locator("main tbody tr").first();
      await t.passo(linha, "", "Dê um duplo clique numa linha que diverge", "", 2600);
      await t.duplo(linha);
      const painel = page.locator("aside.painel-lateral");
      await painel.waitFor();
      await t.focar(null);
      await pausa(1600);
      await t.passo(painel, "1", "Banco de um lado, sistema do outro", "Data, descrição e valor de cada lado, com a diferença entre os dois.", 5000);
      const explicar = painel.getByRole("button", { name: /explicar esta divergência/i });
      if (await explicar.count()) {
        await t.passo(explicar, "2", "O provável motivo", "O Ledgr explica por que a linha não casou. Confira no seu sistema antes de decidir.", 3000);
        await t.clicar(explicar);
        await pausa(3000);
      }
      const justificar = painel.getByRole("button", { name: /^justificar$/i });
      if (await justificar.count()) {
        await t.passo(justificar, "3", "Conferir ou justificar", "A decisão vai para o relatório do mês.", 4000);
      }
      const inteira = painel.getByText(/^abrir em página inteira$/i);
      if (await inteira.count()) await t.passo(inteira, "4", "Para ver maior, **Abrir em página inteira**", "Abaixo fica o histórico da linha: cada evento, quem fez e quando.", 3800);
    },
    fim: ["Detalhe da linha", "Decida cada divergência"],
  },

  fechamentos: {
    titulo: "Fechamentos",
    sub: "Feche o mês e gere o relatório",
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
    fim: ["Fechamentos", "O mês fechado, pronto para o contador"],
  },

  historico: {
    titulo: "Histórico",
    sub: "Tudo o que já foi conciliado",
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
    fim: ["Histórico", "Mês a mês, tudo o que rodou"],
  },

  empresas: {
    titulo: "Empresas",
    sub: "As empresas clientes e a equipe",
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
    fim: ["Empresas", "Cada cliente com os seus dados"],
  },

  configuracoes: {
    titulo: "Configurações",
    sub: "A conta, a aparência e a regra da conciliação",
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
    fim: ["Configurações", "Ctrl e vírgula, de qualquer tela"],
  },

  "nova-conciliacao": {
    titulo: "Nova conciliação",
    sub: "Como enviar os dois extratos e conciliar",
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
    fim: ["Conciliação pronta", "Veja a Comparação para revisar as divergências"],
  },
};

async function gravar(browser, estado, empresa, tela) {
  const roteiro = ROTEIROS[tela];
  const ctx = await browser.newContext({
    viewport: { width: LARGURA, height: ALTURA },
    storageState: estado,
    deviceScaleFactor: ESCALA,
    colorScheme: "light",
  });
  // sem os tutoriais do mascote e sem o roteiro de primeiros passos por cima
  await ctx.addInitScript(() => localStorage.setItem("ledgr:preferencias", JSON.stringify({ tutoriaisDispensados: ["visao-geral","conciliacoes","nova-conciliacao","comparacao","divergencia","extratos","historico","fechamentos","configuracoes"], roteiroDispensado: true })));
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const t = ferramentas(page, empresa);
  if (roteiro.inicio) await t.abrir(roteiro.inicio);
  if (roteiro.antes) await roteiro.antes(t);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(700, 500);

  // a gravação do Playwright sai em 1 Mbps e embaça o texto: aqui guardo os quadros do navegador em JPEG
  // de qualidade alta e monto o vídeo depois, com o ffmpeg, no bitrate que o texto precisa
  const pastaQuadros = path.join(SAIDA, `${tela}-${Date.now()}`);
  fs.mkdirSync(pastaQuadros, { recursive: true });
  const quadros = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const arq = path.join(pastaQuadros, String(quadros.length).padStart(6, "0") + ".jpg");
    fs.writeFileSync(arq, Buffer.from(data, "base64"));
    quadros.push({ arq, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: LARGURA * ESCALA, maxHeight: ALTURA * ESCALA });

  await t.v("capa", roteiro.titulo, roteiro.sub);
  await pausa(3200);
  await t.v("capa");
  await pausa(900);
  await roteiro.cena(t, { page });
  await t.soltar();
  await t.v("capa", ...roteiro.fim);
  await pausa(3000);

  await cdp.send("Page.stopScreencast");
  await ctx.close();
  fs.writeFileSync(path.join(pastaQuadros, "quadros.json"), JSON.stringify(quadros));
  return codificar(quadros, path.join(PUBLICO, `${tela}.webm`));
}

// cada quadro dura até o próximo chegar; o último fica meio segundo
async function codificar(quadros, saida) {
  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
    "-vf", "crop=iw*1345/1360:ih:0:0,scale=1898:1200:flags=lanczos,format=yuv420p", "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-row-mt", "1", "-an", saida], { stdio: ["pipe", "inherit", "inherit"] });
  const terminou = new Promise((resolve) => ff.on("close", resolve));
  const t0 = quadros[0].t;
  const total = Math.ceil((quadros.at(-1).t - t0 + 0.5) * FPS);
  let j = 0;
  for (let k = 0; k < total; k++) {
    while (j + 1 < quadros.length && quadros[j + 1].t - t0 <= k / FPS) j++;
    if (!ff.stdin.write(fs.readFileSync(quadros[j].arq))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  const status = await terminou;
  if (status !== 0) throw new Error(`ffmpeg saiu com ${status}: ${saida}`);
  return { saida, segundos: Math.round(total / FPS), mb: (fs.statSync(saida).size / 1e6).toFixed(1) };
}

async function main() {
  const telas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ROTEIROS);
  for (const tela of telas) if (!ROTEIROS[tela]) throw new Error(`tela sem roteiro: ${tela}`);
  const browser = await chromium.launch({ channel: "chrome" });

  // entrar antes de gravar: o vídeo começa já dentro do app
  const login = await browser.newContext({ viewport: { width: LARGURA, height: ALTURA } });
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
