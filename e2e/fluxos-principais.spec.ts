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

function extratoDoBanco() {
  const transacoes = lancamentos
    .map(
      (l, i) =>
        `<STMTTRN>\n<TRNTYPE>${l.valor.startsWith("-") ? "DEBIT" : "CREDIT"}\n<DTPOSTED>${ano}${mes}${l.dia}\n<TRNAMT>${l.valor}\n<FITID>${ano}${mes}${i}\n<MEMO>${l.descricao.toUpperCase()}\n</STMTTRN>`,
    )
    .join("\n");
  return `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>BRL\n<BANKTRANLIST>\n<DTSTART>${ano}${mes}01\n<DTEND>${ano}${mes}28\n${transacoes}\n</BANKTRANLIST>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n`;
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

test("entrar, conciliar, justificar e fechar o mês", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).first().fill(EMAIL);
  await page.getByLabel(/^senha$/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/e\/[0-9a-f-]{36}\//);
  const empresa = page.url().match(/\/e\/([0-9a-f-]{36})\//)![1];

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
  await page.getByLabel("Justificativa").fill("Tarifa do banco, lançada no sistema no mês seguinte.");
  await page.getByRole("button", { name: "Justificar", exact: true }).click();
  await expect(page.getByLabel("Justificativa")).toHaveCount(0);

  await page.goto(`/e/${empresa}/fechamentos?mes=${competencia}`);
  await pularTutorial(page);
  await page.getByRole("button", { name: new RegExp(`^Fechar ${nomeDoMes}`, "i") }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^Reabrir ${nomeDoMes}`, "i") })).toBeVisible();
});
