import { expect, test } from "@playwright/test";

// Só o backend-fake: cadastro sintético criado no próprio teste, sem dado de cliente.
test("remover a empresa aberta troca o contexto e restaurar devolve empresa e seletor", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).first().fill("financeiro@telhacerta.com.br");
  await page.getByLabel(/^senha$/i).fill("ledgr2026");
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/e\/[0-9a-f-]{36}\//);
  const principal = page.url().match(/\/e\/([0-9a-f-]{36})\//)![1];
  await page.goto(`/e/${principal}/empresas`);

  let cnpj = String(Date.now()).slice(-12);
  for (const pesos of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const resto = [...cnpj].reduce((soma, digito, i) => soma + Number(digito) * pesos[i], 0) % 11;
    cnpj += resto < 2 ? "0" : String(11 - resto);
  }
  const nome = `Empresa sintética ${Date.now()}`;
  await page.getByRole("button", { name: "Adicionar empresa", exact: true }).click();
  const cadastro = page.getByRole("dialog", { name: "Adicionar empresa" });
  await cadastro.getByLabel("CNPJ", { exact: true }).fill(cnpj);
  await cadastro.getByLabel("Razão social", { exact: true }).fill(nome);
  await cadastro.getByRole("button", { name: "Cadastrar empresa", exact: true }).click();
  await page.waitForURL((url) => /\/e\/[0-9a-f-]{36}\/visao-geral/.test(url.pathname) && !url.pathname.includes(principal));
  const criada = page.url().match(/\/e\/([0-9a-f-]{36})\//)![1];
  await page.goto(`/e/${criada}/empresas`);
  await page.getByRole("button", { name: nome, exact: true }).click();
  await page.getByRole("button", { name: "Remover empresa", exact: true }).click();
  const confirmacao = page.getByRole("dialog", { name: "Remover empresa" });
  await expect(confirmacao).toContainText(nome);
  await page.screenshot({ path: test.info().outputPath("remover-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(confirmacao.getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("remover-celular.png") });
  await confirmacao.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(confirmacao).not.toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(nome) })).toBeVisible();

  await page.getByRole("button", { name: "Remover empresa", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar remoção", exact: true }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/empresas") && !url.pathname.includes(criada));
  await expect(page.getByRole("row", { name: new RegExp(nome) })).toHaveCount(0);
  await page.getByRole("button", { name: "Empresas removidas", exact: true }).click();
  const removidas = page.getByRole("dialog", { name: "Empresas removidas" });
  await expect(removidas).toContainText(nome);
  await expect(removidas).toContainText("Restaurar até");
  await page.screenshot({ path: test.info().outputPath("restaurar-celular.png") });
  await removidas.getByRole("button", { name: `Restaurar ${nome}`, exact: true }).click();
  await expect(removidas.getByRole("status")).toContainText(`${nome} foi restaurada`);
  await removidas.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(nome) })).toBeVisible();
  await page.getByRole("button", { name: nome, exact: true }).click();
  await page.getByRole("button", { name: "Abrir esta empresa", exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/e/${criada}/visao-geral`);
  await expect(page.getByRole("button", { name: `Empresa: ${nome}`, exact: true })).toBeVisible();
});
