import { expect, test, type Page } from "@playwright/test";

// O caminho que todo cliente faz todo mês, de ponta a ponta contra o backend de mentira
// (scripts/backend-fake.mjs): entrar, conciliar os dois extratos, justificar o que não bateu e
// fechar o mês. Os testes de unidade conferem as peças; este quebra quando elas não se encaixam.

const EMAIL = "financeiro@telhacerta.com.br";
const SENHA = "ledgr2026";

// um mês que o fake não carrega no boot, sorteado: rodar de novo no mesmo servidor não esbarra no
// mês fechado da vez anterior
const ano = 2000 + Math.floor(Math.random() * 25);
const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
const competencia = `${ano}-${mes}`;
const nomeDoMes = new Date(ano, Number(mes) - 1, 15).toLocaleDateString("pt-BR", { month: "long" });

const lancamentos = [
  { dia: "05", valor: "1250.40", descricao: "Recebimento Construtora Alicerce" },
  { dia: "10", valor: "-830.00", descricao: "Fornecedor Cimento Forte" },
  { dia: "20", valor: "-42.90", descricao: "Tarifa bancaria" },
];

function extratoDoBanco(anoDoExtrato = ano) {
  const transacoes = lancamentos
    .map(
      (l, i) =>
        `<STMTTRN>\n<TRNTYPE>${l.valor.startsWith("-") ? "DEBIT" : "CREDIT"}\n<DTPOSTED>${anoDoExtrato}${mes}${l.dia}\n<TRNAMT>${l.valor}\n<FITID>${anoDoExtrato}${mes}${i}\n<MEMO>${l.descricao.toUpperCase()}\n</STMTTRN>`,
    )
    .join("\n");
  return `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>BRL\n<BANKTRANLIST>\n<DTSTART>${anoDoExtrato}${mes}01\n<DTEND>${anoDoExtrato}${mes}28\n${transacoes}\n</BANKTRANLIST>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n`;
}

// o sistema não lançou a tarifa: sobra uma linha só no banco, a única a justificar
function extratoDoSistema() {
  const linhas = lancamentos.slice(0, 2).map((l) => `${ano}-${mes}-${l.dia};${l.descricao};${l.valor}`);
  return ["data;descricao;valor", ...linhas].join("\n") + "\n";
}

async function pularTutorial(page: Page) {
  const pular = page.getByRole("button", { name: "Pular", exact: true });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).first().fill(EMAIL);
  await page.getByLabel(/^senha$/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/e\/[0-9a-f-]{36}\//);
  return page.url().match(/\/e\/([0-9a-f-]{36})\//)![1];
}

test("entrar, conciliar, justificar e fechar o mês", async ({ page }) => {
  const empresa = await entrar(page);

  await page.goto(`/e/${empresa}/conciliacoes/nova`);
  await pularTutorial(page);
  await page.getByLabel("Extrato do banco").setInputFiles({ name: "banco.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(extratoDoBanco()) });
  await page.getByLabel("Extrato do sistema de gestão").setInputFiles({ name: "sistema.csv", mimeType: "text/csv", buffer: Buffer.from(extratoDoSistema()) });
  await page.getByRole("button", { name: "Conciliar extratos" }).click();
  await page.waitForURL(/\/conciliacoes\/[0-9a-f-]{36}/);
  await pularTutorial(page);

  // a tarifa que só o banco tem: a única em "Só revisão", aberta pela descrição
  await expect(page.getByRole("button", { name: "Só revisão (1)" })).toBeVisible();
  await page.getByRole("button", { name: "TARIFA BANCARIA", exact: true }).click();
  const previa = page.getByRole("complementary", { name: "Detalhe da linha e saldo do extrato" });
  await previa.getByRole("button", { name: "Justificar", exact: true }).click();
  await previa.getByLabel("Justificativa").fill("Tarifa do banco, lançada no sistema no mês seguinte.");
  await previa.getByRole("button", { name: "Justificar", exact: true }).click();
  await expect(previa.getByLabel("Justificativa")).toHaveCount(0);

  await page.goto(`/e/${empresa}/fechamentos?mes=${competencia}`);
  await pularTutorial(page);
  await page.getByRole("button", { name: new RegExp(`^Fechar ${nomeDoMes}`, "i") }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^Reabrir ${nomeDoMes}`, "i") })).toBeVisible();
});

test("reenviar JSON na comparação mantém o banco e abre a nova rodada", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const empresa = await entrar(page);
  const caminho = `/e/${empresa}/conciliacoes`;
  const jsonDoSistema = {
    name: "sistema.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ versao_schema: "1", lancamentos: [
      { data: `2025-${mes}-05`, descricao: "Recebimento fictício", valor: 1250.4 },
    ] })),
  };

  await page.goto(`${caminho}/nova/ia`);
  await pularTutorial(page);
  await page.getByLabel("Arquivo da IA").setInputFiles(jsonDoSistema);
  await page.getByRole("button", { name: "Importar e conferir" }).click();
  await page.getByRole("button", { name: /^Confirmar \d+ lançamentos/ }).click();
  await page.waitForURL(/\/conciliacoes\/nova\?sistema=/);
  const sistemaAnterior = new URL(page.url()).searchParams.get("sistema");
  expect(sistemaAnterior).toMatch(/^[0-9a-f-]{36}$/);
  await pularTutorial(page);
  await page.getByLabel("Extrato do banco").setInputFiles({
    name: "banco.ofx",
    mimeType: "application/x-ofx",
    buffer: Buffer.from(extratoDoBanco(2025)),
  });
  await page.getByRole("button", { name: "Conciliar extratos" }).click();
  await page.waitForURL(/\/conciliacoes\/[0-9a-f-]{36}/);
  await pularTutorial(page);

  const primeiraRodada = new URL(page.url());
  await page.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nova versão do extrato do sistema" });
  await dialogo.getByRole("button", { name: "Gerar JSON com IA" }).click();
  await dialogo.getByRole("button", { name: "Copiar prompt" }).click();
  await expect(dialogo.getByRole("button", { name: "Prompt copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("versao_schema");
  const campo = dialogo.getByLabel("Extrato do sistema de gestão");
  await campo.setInputFiles({ ...jsonDoSistema, buffer: Buffer.from('{"erro":true}') });
  await dialogo.getByRole("button", { name: "Importar e conferir" }).click();
  await expect(dialogo.getByText("O arquivo não passou na conferência")).toBeVisible();
  await expect(dialogo.getByText("Rodada 1 · agora")).toBeVisible();
  expect(page.url()).toBe(primeiraRodada.href);

  await campo.setInputFiles({ ...jsonDoSistema, name: "sistema-corrigido.json" });
  await dialogo.getByRole("button", { name: "Importar e conferir" }).click();
  await expect(page.getByText(/mesmo extrato do banco \(banco\.ofx\)/)).toBeVisible();
  await page.getByRole("button", { name: /^Confirmar \d+ lançamentos/ }).click();
  await page.waitForURL((url) => url.pathname === primeiraRodada.pathname && url.searchParams.has("sistema"));
  const sistemaNovo = new URL(page.url()).searchParams.get("sistema");
  expect(sistemaNovo).toMatch(/^[0-9a-f-]{36}$/);
  expect(sistemaNovo).not.toBe(sistemaAnterior);

  const anterior = page.getByRole("link", { name: /^Rodada 1 ·/ });
  await expect(anterior).toBeVisible();
  await anterior.click();
  await page.waitForURL((url) => url.pathname === primeiraRodada.pathname && url.searchParams.get("sistema") === sistemaAnterior);
});
