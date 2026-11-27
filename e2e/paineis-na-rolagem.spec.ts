import { expect, test } from "@playwright/test";

for (const altura of [600, 900]) {
  test(`painéis laterais não cobrem os filtros no fim da página (altura ${altura})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: altura });
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).first().fill("financeiro@telhacerta.com.br");
    await page.getByLabel(/^senha$/i).fill("ledgr2026");
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(/\/e\/[0-9a-f-]{36}\//);
    const empresa = page.url().match(/\/e\/([0-9a-f-]{36})\//)![1];

    for (const tela of ["extratos", "dashboard", "historico", "fechamentos", "empresas"]) {
      await page.goto(`/e/${empresa}/${tela}`);
      const pular = page.getByRole("button", { name: "Pular", exact: true });
      await pular.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
      if (await pular.isVisible()) {
        await page.getByRole("checkbox", { name: "Não mostrar mais tutoriais" }).check();
        await pular.click();
      }
      await expect(page.locator(".extratos-filtros")).toBeVisible();
      await expect(page.locator(".extratos-filtros button").first()).toBeVisible();
      await expect(page.locator(".extrato-painel, .conc-mesa > .conc-previa").first()).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      // Hit testing real: o centro de cada opção deve receber o clique mesmo quando
      // o painel é empurrado para cima pelo fim da coluna, como na captura do bug.
      await expect.poll(async () => page.locator(".extratos-filtros button").evaluateAll((botoes) =>
        botoes.filter((botao) => {
          const r = botao.getBoundingClientRect();
          if (!r.width || !r.height || r.bottom < 0 || r.top >= innerHeight) return false;
          return !botao.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }).map((botao) => botao.textContent),
      ), tela).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${tela}-fim.png`) });
    }
  });
}
