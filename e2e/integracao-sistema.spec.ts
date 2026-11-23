import { expect, test, type Page } from "@playwright/test";

// Fluxo ponta a ponta da integração com o sistema de gestão (backend #253) contra o backend fake:
// configurar na seção Integração, importar da Nova conciliação, conferir o rascunho (com saldo),
// confirmar, conciliar com o extrato do banco e remover a configuração ao fim.

const EMAIL = "financeiro@telhacerta.com.br";
const SENHA = "ledgr2026";

async function pularTutorial(page: Page) {
  const pular = page.getByRole("button", { name: "Pular", exact: true });
  await pular.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await pular.isVisible().catch(() => false)) {
    await page.getByRole("checkbox", { name: "Não mostrar mais tutoriais" }).check();
    await pular.click();
    await expect(pular).not.toBeVisible();
  }
}

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).first().fill(EMAIL);
  await page.getByLabel(/^senha$/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/e\/[0-9a-f-]{36}\//);
  return page.url().match(/\/e\/([0-9a-f-]{36})\//)![1];
}

function ofxDoMes(ano: number, mes: string) {
  return [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "VERSION:102",
    "",
    "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKTRANLIST>",
    `<DTSTART>${ano}${mes}01<DTEND>${ano}${mes}28`,
    `<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${ano}${mes}05<TRNAMT>1250.40<FITID>${ano}${mes}1<MEMO>RECEBIMENTO CONSTRUTORA ALICERCE</STMTTRN>`,
    `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${ano}${mes}10<TRNAMT>-830.00<FITID>${ano}${mes}2<MEMO>FORNECEDOR CIMENTO FORTE</STMTTRN>`,
    `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${ano}${mes}18<TRNAMT>-195.50<FITID>${ano}${mes}3<MEMO>SERVICO DE ENTREGA</STMTTRN>`,
    "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
  ].join("\n");
}

test("configurar integração, importar do sistema, revisar, confirmar e conciliar", async ({ page }) => {
  const empresa = await entrar(page);
  const segredo = "erp_live_segredo_e2e_2026";
  const urlSistema = "https://erp.telhacerta.example";

  await page.goto(`/e/${empresa}/conciliacoes/nova`);
  await pularTutorial(page);

  // se sobrou configuração de uma execução anterior no mesmo fake, abre e salva de novo; senão vai pelo atalho
  const configurar = page.getByRole("button", { name: "Configurar a integração" });
  if (await configurar.isVisible().catch(() => false)) {
    await configurar.click();
  } else {
    await page.keyboard.press("Control+,");
    await page.getByRole("button", { name: "Integração" }).click();
  }

  const dialogo = page.getByRole("dialog", { name: "Configurações" });
  await expect(dialogo.getByRole("heading", { name: /^Integração/ })).toBeVisible();
  await dialogo.getByLabel("URL do sistema").fill(urlSistema);
  await dialogo.getByLabel("Chave de acesso").fill(segredo);
  await dialogo.getByRole("button", { name: "Salvar integração" }).click();

  await expect(dialogo.getByRole("status")).toHaveText("Integração salva.");
  await expect(dialogo.getByText(urlSistema)).toBeVisible();
  await expect(dialogo.getByText("erp_live…")).toBeVisible();
  await expect(dialogo.getByLabel("Chave de acesso")).toHaveValue("");
  expect(await dialogo.textContent()).not.toContain(segredo);

  await dialogo.getByRole("button", { name: "Fechar configurações" }).click();

  // na Nova conciliação, o botão Importar de um sistema aparece após o refresh do /me
  const abrirImportacao = page.getByRole("button", { name: "Importar de um sistema" });
  await expect(abrirImportacao).toBeVisible();
  await abrirImportacao.click();

  const ano = Number(await page.getByLabel("Ano").inputValue());
  const mes = String(await page.getByLabel("Mês").inputValue()).padStart(2, "0");

  await page.getByRole("button", { name: "Buscar no sistema" }).click();
  await page.waitForURL(/\/conciliacoes\/nova\/ia\/[0-9a-f-]{36}$/);
  await pularTutorial(page);

  await expect(page.getByText("Serviço de entrega · ERP")).toBeVisible();
  await expect(page.getByText(/Saldo final do arquivo:/)).toBeVisible();

  await page.getByRole("button", { name: /^Confirmar 3 lançamentos/ }).click();
  await page.waitForURL(/\/conciliacoes\/nova\?sistema=[0-9a-f-]{36}$/);
  await pularTutorial(page);

  // folha pronta neutra (F3) e sem o botão de importar do sistema
  await expect(page.getByText("Importado e confirmado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Importar de um sistema" })).toHaveCount(0);

  await page.getByLabel("Extrato do banco").setInputFiles({
    name: "banco-erp.ofx",
    mimeType: "application/x-ofx",
    buffer: Buffer.from(ofxDoMes(ano, mes)),
  });
  await page.getByRole("button", { name: "Conciliar extratos" }).click();
  await page.waitForURL(/\/conciliacoes\/[0-9a-f-]{36}\?sistema=[0-9a-f-]{36}/);

  // limpa a configuração para deixar o servidor fake no estado inicial
  await page.keyboard.press("Control+,");
  await dialogo.getByRole("button", { name: "Integração" }).click();
  await dialogo.getByRole("button", { name: "Remover integração" }).click();
  await dialogo.getByRole("button", { name: "Remover de vez" }).click();
  await expect(dialogo.getByRole("status")).toHaveText("Integração removida.");
});

test("resposta grande demais orienta reduzir o período e a busca menor traz só lançamentos dentro do intervalo", async ({ page }) => {
  const empresa = await entrar(page);
  const chaveCurta = "12345678";

  await page.goto(`/e/${empresa}/conciliacoes/nova`);
  await pularTutorial(page);

  await page.keyboard.press("Control+,");
  const dialogo = page.getByRole("dialog", { name: "Configurações" });
  await dialogo.getByRole("button", { name: "Integração" }).click();
  await dialogo.getByLabel("URL do sistema").fill("https://erp.telhacerta.example/simular/sistema_resposta_grande_demais");
  await dialogo.getByLabel("Chave de acesso").fill(chaveCurta);
  await dialogo.getByRole("button", { name: "Salvar integração" }).click();

  // chave de 8 caracteres nunca aparece inteira na tela (mostra só 4 chars de prefixo)
  await expect(dialogo.getByRole("status")).toHaveText("Integração salva.");
  await expect(dialogo.getByText("1234…")).toBeVisible();
  expect(await dialogo.textContent()).not.toContain(chaveCurta);

  await dialogo.getByRole("button", { name: "Fechar configurações" }).click();

  await page.getByRole("button", { name: "Importar de um sistema" }).click();
  await page.getByRole("button", { name: "Buscar no sistema" }).click();

  await expect(page.getByRole("form", { name: "Importar de um sistema" }).getByRole("alert")).toContainText("maior que 5 MB");
  // encurta para 20 a 25 do mesmo mês: o fake devolve apenas datas dentro de [de, ate]
  const anoMes = (await page.getByLabel("Data inicial").inputValue()).slice(0, 7);
  await page.getByLabel("Data inicial").fill(`${anoMes}-20`);
  await page.getByLabel("Data final").fill(`${anoMes}-25`);
  await page.getByRole("button", { name: "Buscar no sistema" }).click();

  await page.waitForURL(/\/conciliacoes\/nova\/ia\/[0-9a-f-]{36}$/);
  await pularTutorial(page);

  const [ano, mes] = anoMes.split("-");
  await expect(page.getByText(`20/${mes}/${ano}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`25/${mes}/${ano}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`05/${mes}/${ano}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`10/${mes}/${ano}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`18/${mes}/${ano}`, { exact: true })).toHaveCount(0);

  // limpa a configuração ao fim
  await page.keyboard.press("Control+,");
  await dialogo.getByRole("button", { name: "Integração" }).click();
  await dialogo.getByRole("button", { name: "Remover integração" }).click();
  await dialogo.getByRole("button", { name: "Remover de vez" }).click();
  await expect(dialogo.getByRole("status")).toHaveText("Integração removida.");
});
