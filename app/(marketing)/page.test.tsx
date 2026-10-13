import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PLANOS } from "@/lib/planos";
import { fonteDestaque } from "./fonte-destaque";
import LandingPage from "./page";

// a landing aqui é a de sempre, sem depoimentos: nem a lista real, quando eles chegarem, nem os de
// exemplo (que dependem do ambiente) podem mudar estes testes. A landing com depoimentos é
// conferida em page-depoimentos.test.tsx, e a escolha entre reais e exemplo em lib/depoimentos.test.ts
vi.mock("@/lib/depoimentos", () => ({ depoimentosDaLanding: () => [] }));

describe("LandingPage", () => {
  // o hero é a primeira seção; a faixa de números vem logo abaixo dele
  const secoes = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("main > section")];

  it("leaves the social networks in the footer, each link named for the screen reader", () => {
    const { container } = render(<LandingPage />);
    const redes = within(container.querySelector("footer")!).getByRole("list", { name: "Ledgr nas redes sociais" });
    expect(within(redes).getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "LinkedIn",
      "Instagram",
      "X (Twitter)",
    ]);
  });

  it("shows the hero headline and a link into the product", () => {
    const { container } = render(<LandingPage />);
    const hero = within(secoes(container)[0]);
    expect(hero.getByRole("heading", { name: "Pare de conciliar extrato à mão." })).toBeInTheDocument();
    expect(hero.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/cadastro");
  });

  it("says in the hero that you keep your system and nobody checks line by line", () => {
    const { container } = render(<LandingPage />);
    const hero = within(secoes(container)[0]);
    // os dois argumentos do pitch: não troca de sistema, e a conferência sai das mãos de alguém
    expect(hero.getByText(/^Continue no sistema de gestão que você já usa\./)).toBeInTheDocument();
    expect(
      hero.getByText(/o Ledgr confere linha por linha e aponta só o que não bate, com o motivo de cada diferença\.$/),
    ).toBeInTheDocument();
  });

  it("keeps the hero to the headline, the text and the CTA", () => {
    const { container } = render(<LandingPage />);
    const hero = within(secoes(container)[0]);
    // as provas saíram para a faixa de números; o formato dos arquivos já está no primeiro passo
    expect(hero.queryByText("categorias de divergência, sempre nomeadas")).not.toBeInTheDocument();
    expect(hero.queryByText("OFX ou CSV, direto do internet banking")).not.toBeInTheDocument();
  });

  it("uses one label for every link into the signup", () => {
    const { container } = render(<LandingPage />);
    const rotulos = [...container.querySelectorAll('a[href="/cadastro"]')].map((link) => link.textContent);
    // cabeçalho, hero e preço
    expect(rotulos).toHaveLength(3);
    expect(new Set(rotulos)).toEqual(new Set(["Começar agora"]));
  });

  it("labels only the four chapters above the section titles", () => {
    const { container } = render(<LandingPage />);
    const rotulos = [...container.querySelectorAll(".eyebrow")].map((rotulo) => rotulo.textContent);
    expect(rotulos).toEqual([
      "Cap. I · O fechamento do mês",
      "Cap. II · O jeito de hoje",
      "Cap. III · Como funciona",
      "Cap. IV · Começar",
    ]);
  });

  it("sets one short stretch of each main title in the display italic", () => {
    const { container } = render(<LandingPage />);
    // a tela do app na vitrine tem os títulos dela, fora da mistura da landing
    const titulos = [...container.querySelectorAll<HTMLElement>("main :is(h1, h2)")].filter((titulo) => !titulo.closest(".vitrine"));

    for (const titulo of titulos) expect(titulo).toHaveClass("titulo-misto");
    expect(titulos.map((titulo) => [titulo.textContent, [...titulo.querySelectorAll("em")].map((em) => em.textContent)])).toEqual([
      ["Pare de conciliar extrato à mão.", ["à mão."]],
      ["Duas telas abertas, um dedo em cada linha.", ["cada linha."]],
      ["Três passos. A conferência linha por linha fica com o Ledgr.", ["com o Ledgr."]],
      ["Cada lançamento, do extrato ao seu sistema.", ["ao seu sistema."]],
      ["Sem trocar de sistema, e sem voltar para o manual.", ["e sem voltar para o manual."]],
      ["O extrato do banco é sempre a fonte da verdade.", ["a fonte da verdade."]],
      ["Perguntas que sempre aparecem", ["sempre aparecem"]],
      ["Preço fechado, por volume.", ["por volume."]],
    ]);
  });

  it("loads the display italic only on the landing, under the variable its titles use", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector("main")!.className).toContain(fonteDestaque.variable);
  });

  it("keeps the sticky header above the hover cards of the page", () => {
    const { container } = render(<LandingPage />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Pagamento fornecedor #1082" }));

    // o cartão do hover é o do app (.cartao-lancamento, z-index 20 no globals.css)
    expect(within(document.getElementById("como")!).getByRole("tooltip")).toHaveClass("cartao-lancamento");
    expect(Number(container.querySelector("header")!.style.zIndex)).toBeGreaterThan(20);
  });

  it("sets the big numbers in lining figures, so the 0 does not read as an o", () => {
    const { container } = render(<LandingPage />);
    const numeros = [
      ...[...container.querySelectorAll(".numeros-grade > *")].map((item) => item.firstElementChild!),
      // o cartão do hero e o relatório do último card de Preços, que mostra o mesmo agosto
      ...screen.getAllByText("96,3%"),
      // e o volume de cada plano na régua de Preços
      ...container.querySelectorAll(".preco-regua-num"),
    ];
    expect(numeros).toHaveLength(3 + 2 + 5);
    for (const numero of numeros) expect(numero).toHaveClass("numero-destaque");
  });

  it("downloads each mascot once, even where it shows up twice with its watermark", () => {
    const { container } = render(<LandingPage />);
    for (const mascote of ["mascote-explicando", "mascote-sentado"]) {
      const copias = [...container.querySelectorAll("img")].filter((img) => img.src.includes(mascote));
      // a marca d'água transparente e o mascote visível
      expect(copias).toHaveLength(2);
      // o mesmo `sizes` faz o navegador escolher a mesma largura do srcset, e baixar uma vez só
      expect(new Set(copias.map((img) => img.getAttribute("sizes")))).toHaveProperty("size", 1);
    }
  });

  it("aligns its paragraphs to the left instead of justifying them", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector(".texto-justificado")).toBeNull();
  });

  it("counts the same five divergence categories the product reports", () => {
    render(<LandingPage />);
    const prova = screen.getByText("categorias de divergência, sempre nomeadas").parentElement!;
    // por extenso, como os outros destaques da faixa
    expect(within(prova).getByText("Cinco")).toBeInTheDocument();
  });

  it("writes its copy without dashes between clauses", () => {
    render(<LandingPage />);

    expect(
      screen.getByText(/Suba o extrato do banco e o do sistema: em minutos o Ledgr confere linha por linha/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não. O Ledgr lê o arquivo que o internet banking já exporta, em OFX ou CSV, e não pede nenhuma credencial bancária."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Exporte o razão do seu ERP ou sistema de gestão no mesmo período, em CSV."),
    ).toBeInTheDocument();
  });

  it("states the golden rule and the pricing model", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { name: "O extrato do banco é sempre a fonte da verdade." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preço fechado, por volume." })).toBeInTheDocument();
  });

  it("has a header with nav links into the product and to the page sections", () => {
    const { container } = render(<LandingPage />);
    const header = within(container.querySelector("header")!);
    expect(header.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(header.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/cadastro");
    expect(header.getByRole("link", { name: "O problema" })).toHaveAttribute("href", "#problema");
    expect(header.getByRole("link", { name: "Como funciona" })).toHaveAttribute("href", "#como");
    expect(header.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "#preco");
  });

  it("shows the numbers right below the hero, and only what is a quantity", () => {
    const { container } = render(<LandingPage />);
    const faixa = within(secoes(container)[1]);
    // abre com o argumento do pitch; as credenciais continuam na FAQ e no rodapé
    expect(faixa.getByText("sistemas para trocar: o Ledgr usa o que o seu sistema de gestão já exporta")).toBeInTheDocument();
    expect(faixa.queryByText(/credenciais bancárias/)).not.toBeInTheDocument();
    expect(screen.getByText(/não pede nenhuma credencial bancária\.$/)).toBeInTheDocument();
    expect(faixa.getByText("para o relatório ficar pronto depois que você sobe os arquivos")).toBeInTheDocument();
    expect(faixa.getByText("categorias de divergência, sempre nomeadas")).toBeInTheDocument();
    // por extenso: algarismo solto na faixa ficava com cara de letra
    expect([...faixa.getAllByText(/./, { selector: ".numero-destaque" })].map((valor) => valor.textContent)).toEqual([
      "Zero",
      "Minutos",
      "Cinco",
    ]);
    // os destaques que não eram número saem
    expect(screen.queryByText("Alto volume")).not.toBeInTheDocument();
    expect(screen.queryByText("Automático")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem instalar nada")).not.toBeInTheDocument();
  });

  it("follows one line, #1082, from the two statements to your own system, right after the how-it-works steps", () => {
    const { container } = render(<LandingPage />);
    // seção própria, logo depois dos três passos: é o que chega no terceiro
    const porDentro = container.querySelector<HTMLElement>("#por-dentro")!;
    expect(porDentro).toContainElement(
      screen.getByRole("heading", { name: "Cada lançamento, do extrato ao seu sistema." }),
    );
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

  describe("the vertical trail in Por dentro", () => {
    const fio = () => document.querySelector<HTMLElement>("#por-dentro .por-dentro-fio")!;

    it("puts the title beside the steps, and the app window below both", () => {
      const { container } = render(<LandingPage />);
      const [passagem, janela] = [...container.querySelector<HTMLElement>("#por-dentro .por-dentro")!.children];
      const [topo, trilha] = [...passagem.children];
      expect(topo).toHaveClass("por-dentro-topo");
      expect(topo).toContainElement(screen.getByRole("heading", { name: "Cada lançamento, do extrato ao seu sistema." }));
      expect(trilha).toHaveClass("por-dentro-percurso");
      expect(trilha.querySelectorAll("ol > li")).toHaveLength(4);
      expect(janela.querySelector(".vitrine")).not.toBeNull();
    });

    it("keeps the sticky title in a box that ends with the steps, so it stops before the app window", () => {
      render(<LandingPage />);
      // o sticky anda dentro do pai: se o pai tiver a janela, o título desce por cima dela
      const pai = document.querySelector("#por-dentro .por-dentro-topo")!.parentElement!;
      expect(pai.querySelector(".vitrine")).toBeNull();
    });

    it("draws one wavy line down the steps, not a stroke per step", () => {
      render(<LandingPage />);
      expect(document.querySelectorAll("#por-dentro .por-dentro-fio")).toHaveLength(1);
      // fora da lista: dentro do <ol> só cabem as etapas
      expect(fio().parentElement).toHaveClass("por-dentro-percurso");
      expect(fio()).toHaveAttribute("aria-hidden", "true");
    });

    // com movimento reduzido, o globals.css mostra o fio inteiro por cima do recorte
    it("starts with the line undrawn, to be drawn as the page scrolls", () => {
      render(<LandingPage />);
      expect(fio().style.clipPath).toBe("inset(0 0 100% 0)");
    });
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
    // a linha do fluxo, em destaque na tabela das duas folhas (e no título do cartão aberto sobre ela)
    const linha = within(tela.querySelector<HTMLElement>("tr[data-destacada]")!);
    expect(linha.getAllByText("Pagamento fornecedor #1082")).toHaveLength(3);
    expect(linha.getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(linha.getByText("R$ 12.604,00")).toBeInTheDocument();
    expect(linha.getByText("Valor diverge na mesma data")).toBeInTheDocument();
    // fora do leitor de tela, a réplica ganha uma descrição
    expect(screen.getByText(/^A tela Comparação direta do Ledgr/)).toBeInTheDocument();
  });

  it("freezes the app's hover card open over line #1082 in the showcase, with the reason for the difference", () => {
    const { container } = render(<LandingPage />);
    const linha = container.querySelector<HTMLElement>("#por-dentro .vitrine-app tr[data-destacada]")!;
    const cartao = within(linha.querySelector<HTMLElement>(".cartao-lancamento")!);
    expect(cartao.getByText("Lançamento · Valor diverge na mesma data")).toBeInTheDocument();
    expect(cartao.getByText("Pagamento fornecedor #1082")).toBeInTheDocument();
    // no formato do cartão do app: a data de cada lado junto do valor
    expect(cartao.getByText("04/08 · R$ 12.640,00")).toBeInTheDocument();
    expect(cartao.getByText("04/08 · R$ 12.604,00")).toBeInTheDocument();
    expect(cartao.getByText(/^O banco descontou R\$ 36,00 de juros por atraso no boleto/)).toBeInTheDocument();
    // a explicação é da IA, que estará ligada no lançamento: vem com o selo, como no produto
    expect(cartao.getByText("Gerada por IA · confira antes de decidir")).toBeInTheDocument();
    // a legenda para o leitor de tela conta o cartão, já que a réplica fica fora dele
    expect(screen.getByText(/o cartão dela aberto com o motivo da diferença/)).toBeInTheDocument();
  });

  describe("the problem, read as the closing done by hand", () => {
    const problema = () => document.getElementById("problema")!;
    const lista = (nome: string) => within(within(problema()).getByRole("list", { name: nome })).getAllByRole("listitem");
    const linha = (nome: string, texto: string) => lista(nome).find((item) => item.textContent!.includes(texto))!;
    const marca = (item: HTMLElement) => item.querySelector(".mao-marca")?.textContent;

    it("opens with the closing of August as it is done by hand", () => {
      render(<LandingPage />);
      expect(
        within(problema()).getByText("Assim é o fechamento de agosto à mão: o extrato do banco de um lado, o do sistema do outro."),
      ).toBeInTheDocument();
    });

    it("shows the two statements as they come, without the Ledgr's marks", () => {
      render(<LandingPage />);
      // as cinco linhas de agosto e a escala do mês, a mesma do cartão do hero
      expect(lista("Extrato do banco")).toHaveLength(6);
      expect(linha("Extrato do banco", "mais 4.213 lançamentos")).toBeInTheDocument();
      expect(lista("Sistema de gestão").some((item) => item.textContent!.includes("R$ 12.604,00"))).toBe(true);
      expect(within(problema()).queryByText("Valor diverge")).not.toBeInTheDocument();
      expect(within(problema()).queryByRole("tooltip")).not.toBeInTheDocument();
      expect(problema().querySelector(".demonstracao-folhas")).toBeNull();
    });

    it("numbers the lines behind each pain", () => {
      render(<LandingPage />);
      expect(marca(linha("Extrato do banco", "mais 4.213 lançamentos"))).toBe("1");
      expect(marca(linha("Extrato do banco", "Crédito cartão D+30"))).toBe("2");
      expect(marca(linha("Sistema de gestão", "Crédito cartão D+30"))).toBe("2");
      expect(marca(linha("Extrato do banco", "Tarifa de manutenção da conta"))).toBe("3");
      expect(marca(linha("Extrato do banco", "Pagamento fornecedor #1082"))).toBeUndefined();
    });

    it("names three pains, each led by its August number", () => {
      render(<LandingPage />);
      const dores = within(problema()).getAllByRole("listitem").filter((item) => item.classList.contains("mao-dor"));
      expect(dores.map((dor) => dor.querySelector(".mao-dor-rotulo")!.textContent)).toEqual(["Tempo", "Erro humano", "O que passa"]);
      // o número de cada dor sai dos próprios lançamentos: a escala do hero, a diferença do cartão, a tarifa
      expect(dores.map((dor) => dor.querySelector(".mao-dor-numero")!.textContent)).toEqual(["4.218 linhas", "R$ 0,05", "R$ 45,00"]);
      expect(dores.map((dor) => within(dor).getByRole("heading", { level: 3 }).textContent)).toEqual([
        "Horas que não voltam",
        "O olho cansa",
        "Aparece depois",
      ]);
      expect(dores.map((dor) => dor.querySelector(".mao-dor-texto")!.textContent)).toEqual([
        "Cada linha do banco é procurada no sistema, uma a uma, todo mês.",
        "Depois da centésima linha, R$ 7.912,45 e R$ 7.912,40 parecem o mesmo número.",
        "A tarifa que ninguém lançou só aparece quando o saldo não fecha.",
      ]);
    });

    it("bridges to Como funciona in a band, without a button to the section right below", () => {
      render(<LandingPage />);
      const ponte = problema().querySelector(".mao-ponte")!;
      expect(ponte.querySelector("p")!.textContent).toBe("O Ledgr confere todas as linhas e aponta só as que não batem, com o motivo.");
      expect(ponte.querySelector("p em")!.textContent).toBe("O Ledgr confere todas as linhas");
      // Como funciona começa logo abaixo: um botão para ela só repetiria a rolagem
      expect(within(problema()).queryByRole("link")).not.toBeInTheDocument();
      expect(problema().nextElementSibling).toBe(document.getElementById("como"));
    });
  });

  it("shows the Ledgr's result at the end of Como funciona, after the three steps", () => {
    render(<LandingPage />);
    const como = document.getElementById("como")!;
    const terceiro = within(como).getByText("Receba as divergências");
    const pratica = within(como).getByRole("heading", { level: 3, name: "As mesmas duas telas, conferidas pelo Ledgr." });
    expect(terceiro.compareDocumentPosition(pratica) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pratica.compareDocumentPosition(como.querySelector(".demonstracao-folhas")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // a demonstração banco × sistema, no fim de Como funciona; "Por dentro do Ledgr" repete alguns destes valores
  const demonstracao = () => within(document.getElementById("como")!);

  it("shows the bank vs. system statement comparison with a mismatch", () => {
    render(<LandingPage />);
    expect(demonstracao().getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(demonstracao().getByText("R$ 12.604,00")).toBeInTheDocument();
  });

  it("names each line's status with the same labels the app uses", () => {
    render(<LandingPage />);
    // uma linha por par, como no app: o selo aparece uma vez, na coluna de status
    expect(demonstracao().getAllByText("Match exato")).toHaveLength(1);
    expect(demonstracao().getAllByText("Valor diverge na mesma data")).toHaveLength(2);
    expect(demonstracao().getAllByText("Mesmo valor em outra data")).toHaveLength(1);
    // a tarifa só do lado do banco é a categoria própria do motor, não uma sobra qualquer
    expect(demonstracao().getByText("Tarifa bancária")).toBeInTheDocument();
  });

  it("draws the demo with the same two-sheet table as the app window in Por dentro", () => {
    render(<LandingPage />);
    const titulos = (raiz: Element) => raiz.querySelector(".tabela-folhas .folhas-titulos")!.textContent;
    const vitrine = document.querySelector("#por-dentro .vitrine-app")!;
    expect(titulos(document.getElementById("como")!)).toBe(titulos(vitrine));
    // as mesmas cinco linhas de agosto, na mesma ordem
    const descricoes = (raiz: Element) =>
      [...raiz.querySelectorAll(".tabela-folhas tbody tr")].map((linha) => linha.querySelector("td:nth-child(2)")!.textContent);
    expect(descricoes(document.getElementById("como")!)).toEqual(descricoes(vitrine));
  });

  it("lists the five categories by the app's names, once, in the third step", () => {
    render(<LandingPage />);
    const lista =
      "valor diverge na mesma data, possível duplicidade, mesmo valor em outra data, sem correspondência e tarifa bancária";
    expect(screen.getByText(`Relatório nas 5 categorias: ${lista}.`)).toBeInTheDocument();
    // o convite que repetia a lista (e o resto da página) saiu
    expect(screen.queryByText(/Cada divergência vem com o nome da categoria/)).not.toBeInTheDocument();
  });

  it("explains the divergence when hovering a mismatched line", () => {
    render(<LandingPage />);

    fireEvent.mouseEnter(screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0]);

    expect(demonstracao().getByText(/juros por atraso/)).toBeInTheDocument();
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

    await waitFor(() => expect(demonstracao().queryByText(/juros por atraso/)).not.toBeInTheDocument());
  });

  it("lists the three how-it-works steps", () => {
    render(<LandingPage />);
    expect(screen.getByText("Suba o extrato do banco")).toBeInTheDocument();
    expect(screen.getByText("Suba o extrato do sistema")).toBeInTheDocument();
    expect(screen.getByText("Receba as divergências")).toBeInTheDocument();
  });

  it("shows no plan prices while billing is not defined", () => {
    render(<LandingPage />);
    const preco = document.getElementById("preco")!;
    // as demonstrações dos cards mostram valores de lançamento; preço de plano, nenhum
    for (const plano of PLANOS) expect(preco.textContent).not.toContain(plano.preco);
  });

  it("shows what comes in every plan as a trail of cards, with the page's own August in the demos", () => {
    render(<LandingPage />);
    const preco = within(document.getElementById("preco")!);
    expect(preco.getAllByRole("article").map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Só o que não bate",
      "O motivo de cada diferença",
      "Sem trocar de sistema",
      "O relatório para o contador",
    ]);
    // a #1082 de "O problema" e o mesmo agosto do cartão do hero
    expect(preco.getByText(/^O banco descontou R\$ 36,00 de juros por atraso no boleto/)).toBeInTheDocument();
    expect(preco.getByText("157 de 4.218 para revisar")).toBeInTheDocument();
    expect(preco.getByRole("list", { name: "Os planos" })).toBeInTheDocument();
  });

  describe("Por que o Ledgr", () => {
    const porQue = () => document.getElementById("por-que")!;
    const tabela = () => within(porQue()).getByRole("table", { name: "As saídas de hoje e o Ledgr, pergunta por pergunta" });
    const linhas = () => [...porQue().querySelectorAll<HTMLTableRowElement>("tbody tr")];

    it("sits on its own between Por dentro and Regra de ouro", () => {
      render(<LandingPage />);
      expect(porQue().tagName).toBe("SECTION");
      expect(document.getElementById("por-dentro")!.nextElementSibling).toBe(porQue());
      expect(porQue().nextElementSibling).toBe(document.getElementById("regra"));
      expect(document.getElementById("problema")!.querySelector(".por-que-tabela")).toBeNull();
    });

    it("opens with its label and title, without taking a chapter label", () => {
      render(<LandingPage />);
      expect(within(porQue()).getByText("Por que o Ledgr")).toHaveClass("rotulo-parte");
      const titulo = within(porQue()).getByRole("heading", { level: 2, name: "Sem trocar de sistema, e sem voltar para o manual." });
      expect(titulo.querySelector("em")!.textContent).toBe("e sem voltar para o manual.");
    });

    it("is a table of the three ways, with each question once", () => {
      render(<LandingPage />);
      expect(within(tabela()).getAllByRole("columnheader").map((celula) => celula.textContent)).toEqual([
        "Hoje",
        "Com o Ledgr",
        "Conferir à mão",
        "Migrar para um sistema com conciliação",
        "Ledgr",
      ]);
      expect(within(tabela()).getAllByRole("rowheader").map((celula) => celula.textContent)).toEqual([
        "Trocar de sistema",
        "Quem confere, todo mês",
        "Para começar",
        "O que custa",
      ]);
    });

    it("leads each answer with the direct answer in bold, so reading across a row compares the three ways", () => {
      render(<LandingPage />);
      const destaques = linhas().map((linha) => [...linha.querySelectorAll("td")].map((celula) => celula.querySelector("strong")?.textContent));
      expect(destaques).toEqual([
        ["Não precisa.", "Precisa.", "Não precisa."],
        ["Alguém que entenda de contabilidade", "O sistema novo", "O Ledgr, linha por linha"],
        ["A planilha de sempre.", "Migrar cadastros, contas e histórico", "Subir dois arquivos"],
        ["As horas de quem confere", "A mensalidade do sistema novo", "Pelo volume de lançamentos do mês"],
      ]);
      // o negrito abre a resposta: o resto da frase continua lá, logo depois dele
      for (const celula of porQue().querySelectorAll("tbody td")) {
        expect(celula.firstChild).toBe(celula.querySelector("strong"));
      }
      expect(linhas()[0].querySelectorAll("td")[1].textContent).toBe("Precisa. A empresa inteira passa para o sistema novo.");
    });

    it("highlights only the Ledgr column", () => {
      render(<LandingPage />);
      const destacadas = [...porQue().querySelectorAll("td.por-que-ledgr")];
      expect(destacadas).toHaveLength(4);
      expect(destacadas).toEqual(linhas().map((linha) => linha.querySelectorAll("td")[2]));
    });

    it("names each answer by its way, for the phone layout", () => {
      render(<LandingPage />);
      for (const linha of linhas()) {
        expect([...linha.querySelectorAll("td")].map((celula) => celula.dataset.rotulo)).toEqual([
          "Conferir à mão",
          "Migrar para um sistema com conciliação",
          "Ledgr",
        ]);
      }
    });

    it("says the Ledgr keeps your system and leaves you only what does not match", () => {
      render(<LandingPage />);
      const [trocar, quem] = [...porQue().querySelectorAll("td.por-que-ledgr")].map((celula) => celula.textContent);
      expect(trocar).toMatch(/^Não precisa\./);
      expect(quem).toMatch(/você revisa só o que não bate, já com o motivo/);
    });

    it("compares kinds of solution, without naming competitors", () => {
      render(<LandingPage />);
      expect(porQue().textContent).not.toMatch(/Conta Azul|Omie|Nibo|Domínio/);
    });

    it("keeps the bands alternating", () => {
      render(<LandingPage />);
      // a onda de cada seção leva a cor da seção de cima: papel (o problema), superfície (Como
      // funciona), faixa clara (Por dentro), superfície (Por que o Ledgr)
      expect(document.getElementById("como")).toHaveClass("onda", "onda-papel");
      expect(document.getElementById("por-dentro")).toHaveClass("onda", "onda-superficie");
      expect(porQue()).toHaveClass("onda", "onda-faixa-clara");
      expect(document.getElementById("regra")).toHaveClass("onda", "onda-superficie");
    });
  });

  it("has no invite section repeating what the steps already say", () => {
    render(<LandingPage />);
    expect(screen.queryByRole("heading", { name: "Suba os arquivos e veja as divergências em minutos." })).not.toBeInTheDocument();
  });

  it("puts the reading mascot, and its watermark, beside the FAQ title", () => {
    render(<LandingPage />);
    const perguntas = within(document.getElementById("perguntas")!);
    expect(perguntas.getByRole("heading", { name: "Perguntas que sempre aparecem" })).toBeInTheDocument();
    expect(perguntas.getByAltText("Mascote Ledgr sentado lendo um panfleto")).toBeInTheDocument();
    expect(document.querySelector("#perguntas .perguntas-marca")).not.toBeNull();
  });

  it("answers whether uploading statements is safe, with what the privacy policy says", () => {
    render(<LandingPage />);
    const perguntas = within(document.getElementById("perguntas")!);
    expect(perguntas.getByText("É seguro subir os meus extratos?")).toBeInTheDocument();
    const resposta = perguntas.getByText(/o arquivo que você sobe não fica guardado/);
    expect(resposta).toHaveTextContent("só a sua empresa vê");
    expect(resposta).toHaveTextContent("Os registros do servidor não guardam o valor nem a descrição completa dos lançamentos.");
    expect(within(resposta).getByRole("link", { name: "política de privacidade" })).toHaveAttribute(
      "href",
      "/privacidade#seguranca",
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

  it("lists all five plans by name and volume, covering the volume shown in the hero demo", () => {
    render(<LandingPage />);
    const preco = within(document.getElementById("preco")!);
    for (const plano of ["Essencial", "Padrão", "Avançado", "Escala", "Volume"]) {
      expect(preco.getByText(plano)).toBeInTheDocument();
    }
    expect(preco.getByText("até 5.000 lançamentos por mês")).toBeInTheDocument();
    expect(preco.getByText("acima de 5.000, para indústria e multi-banco")).toBeInTheDocument();
    expect(within(document.getElementById("preco")!).getByRole("link", { name: "Começar agora" })).toHaveAttribute(
      "href",
      "/cadastro",
    );
  });

  it("has a footer organized into Produto, Empresa and Legal link columns", () => {
    const { container } = render(<LandingPage />);
    const footer = within(container.querySelector("footer")!);
    expect(footer.getByText("Produto")).toBeInTheDocument();
    // na ordem da página, depois dos ícones das redes
    const colunas = footer.getAllByRole("link").filter((link) => !link.closest(".rodape-redes"));
    expect(colunas.slice(0, 4).map((link) => link.textContent)).toEqual([
      "Por que o Ledgr",
      "Como funciona",
      "Regra de ouro",
      "Perguntas",
    ]);
    expect(footer.getByRole("link", { name: "Por que o Ledgr" })).toHaveAttribute("href", "#por-que");
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
