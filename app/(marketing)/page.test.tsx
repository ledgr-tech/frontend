import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LandingPage from "./page";

describe("LandingPage", () => {
  it("shows the hero headline and a link into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { name: "Pare de conciliar extrato à mão." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conciliar meu primeiro extrato" })
    ).toHaveAttribute("href", "/cadastro");
  });

  it("counts the same five divergence categories the product reports", () => {
    render(<LandingPage />);
    const prova = screen.getByText("categorias de divergência, sempre nomeadas").parentElement!;
    expect(within(prova).getByText("5")).toBeInTheDocument();
  });

  it("writes its copy without dashes between clauses", () => {
    render(<LandingPage />);

    expect(
      screen.getByText(/Em minutos você recebe o relatório do que bate e do que não bate, lançamento por lançamento, sem planilha no meio\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/devolve cada divergência na sua categoria\. Você não monta planilha nem confere linha por linha\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não. O Ledgr lê o arquivo que o internet banking já exporta, em OFX ou CSV, e não pede nenhuma credencial bancária."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Exporte o razão do seu ERP ou sistema de gestão no mesmo período, em CSV ou PDF."),
    ).toBeInTheDocument();
  });

  it("states the golden rule and the pricing model", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("O extrato do banco é sempre a fonte da verdade.")
    ).toBeInTheDocument();
    expect(screen.getByText("Preço fechado, por volume.")).toBeInTheDocument();
  });

  it("has a header with nav links into the product and to the page sections", () => {
    const { container } = render(<LandingPage />);
    const header = within(container.querySelector("header")!);
    expect(header.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(header.getByRole("link", { name: "Começar" })).toHaveAttribute("href", "/cadastro");
    expect(header.getByRole("link", { name: "O problema" })).toHaveAttribute("href", "#problema");
    expect(header.getByRole("link", { name: "Como funciona" })).toHaveAttribute("href", "#como");
    expect(header.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "#preco");
  });

  it("shows the em números stats", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("a maior parte dos lançamentos casa sem precisar mexer em nada")
    ).toBeInTheDocument();
    expect(
      screen.getByText("para o relatório ficar pronto depois que você sobe os arquivos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("nenhuma integração bancária pra configurar")
    ).toBeInTheDocument();
  });

  it("follows one line, #1082, from the two statements to your own system, right after the how-it-works steps", () => {
    const { container } = render(<LandingPage />);
    // seção própria, logo depois dos três passos: é o que chega no terceiro
    const porDentro = container.querySelector<HTMLElement>("#por-dentro")!;
    expect(porDentro).toContainElement(screen.getByText("Por dentro do Ledgr"));
    expect(container.querySelector("#como")?.nextElementSibling).toBe(porDentro);
    // as quatro etapas, em ordem; termina no sistema de gestão, não numa decisão dentro do app
    const etapas = [...porDentro.querySelectorAll<HTMLElement>(".por-dentro-etapa")];
    expect(etapas.map((etapa) => within(etapa).getByRole("heading").textContent)).toEqual([
      "Duas versões da mesma linha",
      "O Ledgr acha a diferença",
      "E diz o motivo",
      "Você corrige no seu sistema",
    ]);
    // sem recorte em cada etapa: quem mostra o produto é a tela inteira, logo abaixo
    expect(porDentro.querySelector(".por-dentro-recorte")).toBeNull();
  });

  it("shows the whole app screen below the flow, with line #1082 highlighted, as a showcase that is not clickable", () => {
    const { container } = render(<LandingPage />);
    const tela = container.querySelector<HTMLElement>("#por-dentro .vitrine-app")!;
    expect(tela.closest("[inert]")).not.toBeNull();
    const dentro = within(tela);
    // o casco do app, com Conciliações aceso, e a comparação direta de agosto de uma empresa genérica
    expect(dentro.getByText("Conciliações").closest("[data-ativo]")).not.toBeNull();
    expect(dentro.getByRole("heading", { name: "Comparação direta" })).toBeInTheDocument();
    expect(dentro.getByText("Sua empresa · competência agosto/2026 · 4.218 lançamentos")).toBeInTheDocument();
    // o relatório é o componente do app, com o mesmo agosto do topo da página
    expect(dentro.getByRole("heading", { name: "Divergências por categoria" })).toBeInTheDocument();
    expect(dentro.getByText(/^157 linhas pedem revisão/)).toBeInTheDocument();
    // a linha do fluxo, em destaque na tabela das duas folhas
    const linha = within(tela.querySelector<HTMLElement>("tr[data-destacada]")!);
    expect(linha.getAllByText("Pagamento fornecedor #1082")).toHaveLength(2);
    expect(linha.getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(linha.getByText("R$ 12.604,00")).toBeInTheDocument();
    expect(linha.getByText("Valor diverge na mesma data")).toBeInTheDocument();
    // fora do leitor de tela, a réplica ganha uma descrição
    expect(screen.getByText(/^A tela Comparação direta do Ledgr/)).toBeInTheDocument();
  });

  // a demonstração banco × sistema; "Por dentro do Ledgr" repete alguns destes valores
  const demonstracao = () => within(document.getElementById("problema")!);

  it("shows the bank vs. system statement comparison with a mismatch", () => {
    render(<LandingPage />);
    expect(demonstracao().getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(demonstracao().getByText("R$ 12.604,00")).toBeInTheDocument();
  });

  it("names each line's status with the same labels the app uses", () => {
    render(<LandingPage />);
    expect(demonstracao().getAllByText("Match exato")).toHaveLength(2);
    expect(demonstracao().getAllByText("Valor diverge na mesma data")).toHaveLength(4);
    expect(demonstracao().getAllByText("Mesmo valor em outra data")).toHaveLength(2);
    // a tarifa só do lado do banco é a categoria própria do motor, não uma sobra qualquer
    expect(demonstracao().getByText("Tarifa bancária")).toBeInTheDocument();
  });

  it("lists the five categories by the app's names wherever the site names them", () => {
    render(<LandingPage />);
    const lista =
      "valor diverge na mesma data, possível duplicidade, mesmo valor em outra data, sem correspondência e tarifa bancária";
    expect(screen.getByText(`Relatório nas 5 categorias: ${lista}.`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Cada divergência vem com o nome da categoria: ${lista}\.`))).toBeInTheDocument();
  });

  it("explains the divergence when hovering a mismatched line", () => {
    render(<LandingPage />);

    fireEvent.mouseEnter(screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0]);

    expect(screen.getByText(/juros por atraso/)).toBeInTheDocument();
  });

  it("tells mouse users to hover and touch users to tap the comparison lines", () => {
    render(<LandingPage />);
    expect(screen.getByText("Passe o mouse sobre as linhas")).toHaveClass("so-mouse");
    expect(screen.getByText("Toque nas linhas")).toHaveClass("so-toque");
  });

  it("does not treat a matched line as clickable", () => {
    render(<LandingPage />);

    expect(screen.queryByRole("button", { name: /Recebimento cliente Alfa Comércio/ })).not.toBeInTheDocument();
  });

  it("hides the divergence details when the mouse leaves the line", async () => {
    render(<LandingPage />);
    const linha = screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0];
    fireEvent.mouseEnter(linha);

    fireEvent.mouseLeave(linha);

    await waitFor(() => expect(screen.queryByText(/juros por atraso/)).not.toBeInTheDocument());
  });

  it("lists the three how-it-works steps", () => {
    render(<LandingPage />);
    expect(screen.getByText("Suba o extrato do banco")).toBeInTheDocument();
    expect(screen.getByText("Suba o extrato do sistema")).toBeInTheDocument();
    expect(screen.getByText("Receba as divergências")).toBeInTheDocument();
  });

  it("invites early companies with a CTA into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("Suba os arquivos e veja as divergências em minutos.")
    ).toBeInTheDocument();
    // quem chega pela primeira vez vai criar a conta; o "Entrar" do cabeçalho segue no login
    expect(screen.getByRole("link", { name: "Testar agora, gratuito" })).toHaveAttribute(
      "href",
      "/cadastro"
    );
  });

  it("answers the FAQ questions", () => {
    render(<LandingPage />);
    expect(screen.getByText("Preciso instalar algo no meu banco?")).toBeInTheDocument();
    expect(screen.getByText("E se o CSV do meu sistema vier em outro formato?")).toBeInTheDocument();
    expect(screen.getByText("Quem decide o que é divergência?")).toBeInTheDocument();
    expect(screen.getByText("O contador consegue acessar?")).toBeInTheDocument();
  });

  it("does not promise what the product does not do yet", () => {
    render(<LandingPage />);
    // um relatório por par de extratos, sem papéis de usuário, sem cobrança no ar
    expect(screen.queryByText(/consolida tudo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/papel de leitor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/direto pelo painel/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bancos processados num só relatório/)).not.toBeInTheDocument();
    expect(screen.getByText(/a cobrança ainda não está no ar/)).toBeInTheDocument();
  });

  it("lists all five pricing tiers, covering the volume shown in the hero demo", () => {
    render(<LandingPage />);
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("R$ 79,90")).toBeInTheDocument();
    expect(screen.getByText("Avançado")).toBeInTheDocument();
    expect(screen.getByText("R$ 99,90")).toBeInTheDocument();
    expect(screen.getByText("Escala")).toBeInTheDocument();
    expect(screen.getByText("R$ 149,90")).toBeInTheDocument();
    expect(screen.getByText("até 5.000 lançamentos por mês")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/cadastro");
  });

  it("has a footer organized into Produto, Empresa and Legal link columns", () => {
    const { container } = render(<LandingPage />);
    const footer = within(container.querySelector("footer")!);
    expect(footer.getByText("Produto")).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Como funciona" })).toHaveAttribute("href", "#como");
    expect(footer.getByRole("link", { name: "Regra de ouro" })).toHaveAttribute("href", "#regra");
    expect(footer.getByRole("link", { name: "Perguntas" })).toHaveAttribute("href", "#perguntas");
    expect(footer.getByText("Empresa")).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "#preco");
    expect(footer.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "mailto:ledgrtech@gmail.com");
    expect(footer.getByText("Legal")).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
    expect(footer.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
    // "Segurança" é a seção da política, não a Regra de ouro
    expect(footer.getByRole("link", { name: "Segurança" })).toHaveAttribute("href", "/privacidade#seguranca");
    // os direitos do titular são a seção da LGPD na política
    expect(footer.getByRole("link", { name: "LGPD" })).toHaveAttribute("href", "/privacidade#direitos");
    expect(screen.getByText("© 2026 Ledgr · Passo Fundo, RS")).toBeInTheDocument();
  });
});
