// Grava o vídeo-tutorial "Nova conciliação" da Central de ajuda: app local + legendas, destaque e cursor desenhados na página.
//
// Como rodar (Windows, Git Bash), com o backend local em :8000 e o front de produção local em :3950
// (npm run build e AUTH_TRUST_HOST=true npx next start -p 3950, com o env de ~/postgres18/env-do-front.local):
//   npm i --no-save playwright-core
//   FFMPEG=<ffmpeg do Playwright: %LOCALAPPDATA%ms-playwrightfmpeg-*fmpeg-win64.exe> //   EMAIL=<conta de teste> SENHA=<senha> SAIDA_FINAL=<arquivo.webm> node scripts/ajuda-videos/gravar-nova-conciliacao.mjs
// Cada gravação ENVIA os CSVs de verdade: troque o mês dos CSVs a cada vez (datas e nome) ou a conciliação repete.
// O resultado vai para public/ajuda/<tela>.webm e o campo video da página em app/(ajuda)/ajuda/paginas.ts.
import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3950";
const EMAIL = process.env.EMAIL;
const SENHA = process.env.SENHA;
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SAIDA = process.env.SAIDA ?? path.join(os.tmpdir(), "ledgr-ajuda-videos");
const LARGURA = 1360;
const ALTURA = 850;
const FPS = 30;
const ESCALA = 2; // pixels reais por pixel da página: texto nítido
const FFMPEG = process.env.FFMPEG; // o ffmpeg que vem com o Playwright
const SAIDA_FINAL = process.env.SAIDA_FINAL ?? path.join(SAIDA, "nova-conciliacao.webm");
fs.mkdirSync(SAIDA, { recursive: true });

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// o que fica desenhado por cima do app: legenda embaixo, destaque no elemento, cursor
function OVERLAY() {
  if (window.__v) return;
  if (!document.documentElement) return void new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); OVERLAY(); } }).observe(document, { childList: true });
  const css = document.createElement("style");
  css.textContent = `
    #v-legenda{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);z-index:2147483646;max-width:880px;
      background:rgba(32,31,29,.94);color:#f3f2f2;border-radius:16px;padding:16px 26px;opacity:0;
      font:500 18px/1.4 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);
      transition:opacity .35s,transform .35s;display:flex;gap:16px;align-items:center;pointer-events:none}
    #v-legenda.on{opacity:1;transform:translate(-50%,0)}
    #v-legenda b{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;
      background:#b68235;color:#fff;font:700 17px Inter,system-ui,sans-serif}
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
  const mk = (id, html = "") => {
    const e = document.createElement("div");
    e.id = id;
    e.innerHTML = html;
    document.documentElement.append(e);
    return e;
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
      if (!texto) return void legenda.classList.remove("on");
      legenda.innerHTML = (passo ? `<b>${passo}</b>` : "") + `<div>${texto}${detalhe ? `<small>${detalhe}</small>` : ""}</div>`;
      legenda.classList.add("on");
    },
    foco(r) {
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
      const o = document.createElement("div");
      o.className = "v-onda";
      o.style.left = x + "px";
      o.style.top = y + "px";
      document.documentElement.append(o);
      setTimeout(() => o.remove(), 700);
    },
  };
  addEventListener("mousemove", (e) => (cursor.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`), true);
};

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });

  // entrar antes de gravar: o vídeo começa já dentro do app
  const login = await browser.newContext({ viewport: { width: LARGURA, height: ALTURA } });
  const pl = await login.newPage();
  await pl.goto(`${BASE}/login`);
  await pl.getByLabel(/e-?mail/i).first().fill(EMAIL);
  await pl.getByLabel(/senha/i).first().fill(SENHA);
  await pl.getByRole("button", { name: /^entrar$/i }).click();
  await pl.waitForURL(/visao-geral|plano|conciliacoes/, { timeout: 30000 });
  const estado = await login.storageState();
  await login.close();

  const ctx = await browser.newContext({
    viewport: { width: LARGURA, height: ALTURA },
    storageState: estado,
    deviceScaleFactor: ESCALA,
  });
  await ctx.addInitScript(() => localStorage.setItem("ledgr:preferencias", JSON.stringify({ tutoriaisDispensados: ["visao-geral","conciliacoes","nova-conciliacao","comparacao","divergencia","extratos","historico","fechamentos","configuracoes"], roteiroDispensado: true })));
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();

  // a gravação do Playwright sai em 1 Mbps e embaça o texto: aqui guardo os quadros do navegador em JPEG
  // de qualidade alta e monto o vídeo depois, com o ffmpeg, no bitrate que o texto precisa
  const pastaQuadros = path.join(SAIDA, "quadros-" + Date.now());
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
  const v = (fn, ...args) => page.evaluate(([f, a]) => window.__v[f](...a), [fn, args]);

  let cursorEm = { x: 700, y: 500 };
  const ir = async (loc) => {
    const r = await loc.boundingBox();
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
    return r;
  };
  const focar = async (loc) => v("foco", await loc.boundingBox());
  const clicar = async (loc) => {
    const r = await ir(loc);
    await v("onda", r.x + r.width / 2, r.y + r.height / 2);
    await pausa(250);
  };

  await page.goto(`${BASE}/visao-geral`);
  await page.waitForLoadState("networkidle");
  await page.mouse.move(700, 500);
  await v("capa", "Nova conciliação", "Como enviar os dois extratos e conciliar");
  await pausa(3200);
  await v("capa");
  await pausa(900);

  // 1. abrir a tela pelo menu
  const menu = page.getByRole("link", { name: /nova concilia/i }).first();
  await v("legenda", "", "Abra <b style='display:inline;background:none;color:#e0b878;width:auto;height:auto'>Nova conciliação</b> no menu lateral");
  await focar(menu);
  await pausa(1500);
  await clicar(menu);
  await v("foco");
  await menu.click();
  await page.waitForURL(/conciliacoes\/nova/);
  await page.waitForLoadState("networkidle");
  await pausa(1000);

  // 2. a ideia da tela
  await v("legenda", "", "Você envia o extrato do banco e o do sistema de gestão, do mesmo período", "O Ledgr compara os dois linha por linha.");
  await focar(page.locator(".nova-encaixe"));
  await pausa(4200);

  // 3. extrato do banco
  const banco = page.locator('input[aria-label="Extrato do banco"]');
  const cartaoBanco = banco.locator("xpath=..");
  await v("legenda", "1", "Envie o extrato do banco", "OFX ou CSV exportado do internet banking, até 4 MB.");
  await focar(cartaoBanco);
  await pausa(1800);
  await clicar(cartaoBanco);
  await banco.setInputFiles(path.join(AQUI, "banco-dezembro-2025.csv"));
  await pausa(2600);

  // 4. extrato do sistema
  const sistema = page.locator('input[aria-label="Extrato do sistema de gestão"]');
  const cartaoSistema = sistema.locator("xpath=..");
  await v("legenda", "2", "Envie o extrato do sistema de gestão", "Um CSV com data, descrição e valor, do mesmo mês.");
  await focar(cartaoSistema);
  await pausa(1800);
  await clicar(cartaoSistema);
  await sistema.setInputFiles(path.join(AQUI, "erp-dezembro-2025.csv"));
  await pausa(2600);

  // 5. conciliar
  const botao = page.getByRole("button", { name: /conciliar extratos/i });
  await v("legenda", "3", "Clique em Conciliar extratos", "O botão libera quando os dois arquivos estão no lugar.");
  await focar(botao);
  await pausa(1800);
  await clicar(botao);
  await v("foco");
  await v("legenda", "", "O Ledgr está lendo e comparando os dois arquivos…");
  await botao.click();

  // 6. resultado: a comparação abre sozinha
  await page.waitForURL(/\/conciliacoes\/[0-9a-f-]{20,}/, { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  await pausa(1500);
  const resumo = page.locator("[data-tutorial=resumo]");
  await v("legenda", "", "Pronto: a comparação abre sozinha", "O que bateu fica de um lado; o que diverge, para você revisar.");
  await pausa(3500);
  await v("legenda", "", "O resumo mostra as divergências por categoria", "Clique numa categoria para ver só as linhas dela.");
  await focar(resumo);
  await pausa(5500);
  await v("foco");
  await v("legenda");
  await v("capa", "Conciliação pronta", "Veja a Comparação para revisar as divergências");
  await pausa(3000);

  await cdp.send("Page.stopScreencast");
  await ctx.close();
  await browser.close();

  // cada quadro dura até o próximo chegar; o último fica meio segundo
  // o ffmpeg do Playwright é enxuto (sem concat): monto uma sequência a 30 fps, em que cada passo
  // aponta (link físico, sem copiar) para o último quadro já recebido naquele instante
  fs.writeFileSync(path.join(pastaQuadros, "quadros.json"), JSON.stringify(quadros));
  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
    "-vf", "crop=iw*1345/1360:ih:0:0,scale=1898:1200:flags=lanczos,format=yuv420p", "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-row-mt", "1", "-an", SAIDA_FINAL], { stdio: ["pipe", "inherit", "inherit"] });
  const terminou = new Promise((resolve) => ff.on("close", resolve));
  const t0 = quadros[0].t;
  const total = Math.ceil((quadros.at(-1).t - t0 + 0.5) * FPS);
  let j = 0;
  for (let k = 0; k < total; k++) {
    while (j + 1 < quadros.length && quadros[j + 1].t - t0 <= k / FPS) j++;
    if (!ff.stdin.write(fs.readFileSync(quadros[j].arq))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  const r = { status: await terminou };
  console.log("quadros:", quadros.length, "ffmpeg:", r.status, "->", SAIDA_FINAL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
