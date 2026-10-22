import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import type { Papel } from "@/lib/papel";
import type { LimitesDaConta } from "@/lib/limites";
import { ProvedorDaConta } from "../conta";
import { PainelDaEquipe, useEquipe } from "./painel-da-equipe";

// as ações são a fronteira com o backend; aqui devolvem o que ele responderia
const carregarEquipe = vi.fn();
const convidar = vi.fn();
const cancelarConvite = vi.fn();
const removerPessoa = vi.fn();
const trocarPapel = vi.fn();
const transferirAdmin = vi.fn();
vi.mock("../equipe/acoes", () => ({
  trocarPapel: (...args: unknown[]) => trocarPapel(...args),
  transferirAdmin: (...args: unknown[]) => transferirAdmin(...args),
  carregarEquipe: (...args: unknown[]) => carregarEquipe(...args),
  convidar: (...args: unknown[]) => convidar(...args),
  cancelarConvite: (...args: unknown[]) => cancelarConvite(...args),
  removerPessoa: (...args: unknown[]) => removerPessoa(...args),
}));
vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: async () => true }));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/e/x/empresas" }));

const ADMIN = { id: "u1", nome: "Ana", email: "ana@x.com", papel: "admin" };
const BIA = { id: "u2", nome: "Bia", email: "bia@x.com", papel: "analista" };
const GESTOR = { id: "u3", nome: "Gil", email: "gil@x.com", papel: "gestor" };
const CONVITE = { id: "c1", email: "caio@x.com", papel: "analista", enviadoEm: "16/10/2026", valeAte: "23/10/2026" };

/** A equipe como a tela a monta: o hook que carrega e o painel que mostra, com o convite aberto. */
function Equipe({ aberto = true }: { aberto?: boolean }) {
  const equipe = useEquipe();
  const [conviteAberto, setConviteAberto] = useState(aberto);
  return <PainelDaEquipe {...equipe} conviteAberto={conviteAberto} aoFecharConvite={() => setConviteAberto(false)} />;
}

function montar(papel: Papel = "admin", email = ADMIN.email, limites: LimitesDaConta | null = null, aberto = true, temSenha = true) {
  render(
    <ProvedorDaConta preferencias={null} limites={limites} papel={papel} email={email} temSenha={temSenha}>
      <Equipe aberto={aberto} />
    </ProvedorDaConta>,
  );
}

/** A linha inteira de uma pessoa ou de um convite, pelo nome ou e-mail. */
function linhaDe(nome: string) {
  return screen.getByText(nome, { selector: ".equipe-nome" }).closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  carregarEquipe.mockResolvedValue({ ok: true, dados: { pessoas: [ADMIN, BIA], convites: [CONVITE] } });
});

describe("a equipe", () => {
  it("enquanto carrega, diz que está carregando", () => {
    carregarEquipe.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByText("Carregando a equipe…")).toBeInTheDocument();
  });

  it("o admin vê as pessoas, os pendentes, Cancelar e Remover", async () => {
    montar();

    expect(await screen.findByText("Bia", { selector: ".equipe-nome" })).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledWith("admin");
    // só um Remover: o da Bia; a própria linha e a do administrador não têm
    expect(screen.getAllByRole("button", { name: "Remover" })).toHaveLength(1);
    expect(within(linhaDe("Ana")).getByText("você")).toBeInTheDocument();
    expect(within(linhaDe("Ana")).getByText("Administrador")).toBeInTheDocument();
    expect(within(linhaDe("Bia")).getByText("Analista")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail da pessoa")).toBeInTheDocument();
    expect(screen.getByText("Convites pendentes")).toBeInTheDocument();
    expect(screen.getByText("Analista · Enviado em 16/10/2026 · vale até 23/10/2026")).toBeInTheDocument();
    expect(within(linhaDe("caio@x.com")).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("o analista vê só a lista e a frase", async () => {
    carregarEquipe.mockResolvedValue({ ok: true, dados: { pessoas: [ADMIN, BIA], convites: null } });
    montar("analista", BIA.email);

    expect(await screen.findByText("Ana", { selector: ".equipe-nome" })).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledWith("analista");
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail da pessoa")).not.toBeInTheDocument();
    expect(screen.getByText("Só o administrador e o gestor convidam pessoas; só o administrador remove.")).toBeInTheDocument();
    expect(within(linhaDe("Bia")).getByText("você")).toBeInTheDocument();
  });

  it("o gestor convida e cancela convite, mas não remove ninguém, e só oferece o papel de analista", async () => {
    carregarEquipe.mockResolvedValue({ ok: true, dados: { pessoas: [ADMIN, GESTOR, BIA], convites: [CONVITE] } });
    montar("gestor", GESTOR.email);

    expect(await screen.findByText("Bia", { selector: ".equipe-nome" })).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledWith("gestor");
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(within(linhaDe("Gil")).getByText("Gestor")).toBeInTheDocument();
    expect(within(linhaDe("caio@x.com")).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gestor/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Analista/ })).toBeDisabled();
  });

  it("o convite explica cada papel; o admin escolhe entre gestor e analista, e o padrão é o de menos poder", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValue({ ok: true, dados: { id: "c3", email: "eva@x.com", papel: "gestor", enviadoEm: "16/10/2026", valeAte: "23/10/2026" } });
    montar();

    const gestor = await screen.findByRole("button", { name: /^Gestor/ });
    const analista = screen.getByRole("button", { name: /^Analista/ });
    expect(gestor).toHaveTextContent("Cadastra empresas, convida analistas, fecha o mês e aprova justificativas.");
    expect(analista).toHaveTextContent("Concilia e justifica divergências. Não fecha o mês nem convida.");
    expect(analista).toHaveAttribute("aria-pressed", "true");
    expect(gestor).toHaveAttribute("aria-pressed", "false");

    await user.click(gestor);
    await user.type(screen.getByLabelText("E-mail da pessoa"), "eva@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(convidar).toHaveBeenCalledWith("eva@x.com", "gestor");
    expect(await screen.findByText("eva@x.com", { selector: ".equipe-nome" })).toBeInTheDocument();
  });

  it("o convite abre numa janela modal que se fecha por Fechar, Esc e clique no fundo", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    const janela = screen.getByRole("dialog", { name: "Convidar pessoa" });
    expect(within(janela).getByLabelText("E-mail da pessoa")).toBeInTheDocument();
    await user.click(within(janela).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o painel do convite só aparece quando a tela o abre", async () => {
    montar("admin", ADMIN.email, null, false);

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(screen.queryByLabelText("E-mail da pessoa")).not.toBeInTheDocument();
  });

  it("confirma a remoção na própria linha e tira a pessoa da lista", async () => {
    const user = userEvent.setup();
    removerPessoa.mockResolvedValue({ ok: true, dados: null });
    montar();

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));
    const linha = linhaDe("Bia");
    expect(
      within(linha).getByText("Bia perde o acesso na hora. As decisões que registrou continuam no histórico com o nome da pessoa."),
    ).toBeInTheDocument();
    await user.click(within(linha).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByText("Bia", { selector: ".equipe-nome" })).not.toBeInTheDocument());
    expect(removerPessoa).toHaveBeenCalledTimes(1);
    expect(removerPessoa).toHaveBeenCalledWith("u2");
  });

  it("desistir da remoção volta a linha como estava", async () => {
    const user = userEvent.setup();
    montar();

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Cancelar" }));

    expect(within(linhaDe("Bia")).getByRole("button", { name: "Remover" })).toBeInTheDocument();
    expect(removerPessoa).not.toHaveBeenCalled();
  });

  it("trava os botões enquanto a ação roda", async () => {
    const user = userEvent.setup();
    removerPessoa.mockReturnValue(new Promise(() => {}));
    convidar.mockReturnValue(new Promise(() => {}));
    montar();

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));
    const confirmar = within(linhaDe("Bia")).getByRole("button", { name: "Remover" });
    await user.click(confirmar);
    await user.click(confirmar);
    expect(removerPessoa).toHaveBeenCalledTimes(1);
    expect(confirmar).toBeDisabled();

    await user.type(screen.getByLabelText("E-mail da pessoa"), "dani@x.com");
    const enviar = screen.getByRole("button", { name: "Enviar convite" });
    await user.click(enviar);
    await user.click(enviar);
    expect(convidar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  });

  it("convidar põe o convite no topo dos pendentes e mostra o retorno", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValue({ ok: true, dados: { id: "c2", email: "dani@x.com", papel: "analista", enviadoEm: "16/10/2026", valeAte: "23/10/2026" } });
    montar();

    await user.type(await screen.findByLabelText("E-mail da pessoa"), "dani@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Convite enviado para dani@x.com. O link vale até 23/10/2026.");
    expect(screen.getByLabelText("E-mail da pessoa")).toHaveValue("");
    const titulos = screen.getAllByText(/@x\.com$/, { selector: ".equipe-nome" }).map((no) => no.textContent);
    expect(titulos.filter((t) => t === "dani@x.com" || t === "caio@x.com")).toEqual(["dani@x.com", "caio@x.com"]);
  });

  it("mostra o erro do convite e mantém o e-mail digitado", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValue({ ok: false, status: 409, erro: "Este e-mail já tem conta no Ledgr." });
    montar();

    await user.type(await screen.findByLabelText("E-mail da pessoa"), "bia@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este e-mail já tem conta no Ledgr.");
    expect(screen.getByLabelText("E-mail da pessoa")).toHaveValue("bia@x.com");
  });

  it("e-mail incompleto não chama a ação", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(await screen.findByLabelText("E-mail da pessoa"), "dani@");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Confira o e-mail: parece incompleto.");
    expect(convidar).not.toHaveBeenCalled();
  });

  it("cancelar um convite tira ele dos pendentes", async () => {
    const user = userEvent.setup();
    cancelarConvite.mockResolvedValue({ ok: true, dados: null });
    montar();

    await screen.findByText("caio@x.com", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("caio@x.com")).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByText("caio@x.com", { selector: ".equipe-nome" })).not.toBeInTheDocument());
    expect(cancelarConvite).toHaveBeenCalledWith("c1");
    expect(screen.queryByText("Convites pendentes")).not.toBeInTheDocument();
  });

  it("404 ao carregar diz que ainda não está disponível, sem controles", async () => {
    carregarEquipe.mockResolvedValue({ ok: false, status: 404, erro: "Not Found" });
    montar();

    expect(await screen.findByText("A equipe ainda não está disponível.")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail da pessoa")).not.toBeInTheDocument();
  });

  it("falha ao carregar oferece Tentar de novo, que carrega outra vez", async () => {
    const user = userEvent.setup();
    carregarEquipe.mockResolvedValueOnce({ ok: false, status: 500, erro: "x" });
    montar();

    expect(await screen.findByText("Não foi possível carregar agora.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Bia", { selector: ".equipe-nome" })).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledTimes(2);
  });

  it("403 numa ação avisa e carrega a equipe de novo", async () => {
    const user = userEvent.setup();
    cancelarConvite.mockResolvedValue({ ok: false, status: 403, erro: "Só o administrador pode fazer isso." });
    montar();

    await screen.findByText("caio@x.com", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("caio@x.com")).getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Só o administrador pode fazer isso.");
    await waitFor(() => expect(carregarEquipe).toHaveBeenCalledTimes(2));
  });

  it("401 em qualquer ação vai para o login, sem erro preso na tela", async () => {
    const user = userEvent.setup();
    removerPessoa.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." });
    montar();

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("a faixa do plano para pessoas", () => {
  const COM = (usadas: number, maximo: number | null): LimitesDaConta => ({ empresas: null, usuarios: { usadas, maximo } });

  it("mostra quanto a conta usa e avisa quando falta pouco", async () => {
    montar("admin", ADMIN.email, COM(2, 3));

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(screen.getByText("2 de 3 pessoas")).toBeInTheDocument();
    expect(screen.getByText("Falta 1 pessoa para o limite do plano.")).toBeInTheDocument();
  });

  it("com folga, diz que os convites pendentes contam", async () => {
    montar("admin", ADMIN.email, COM(1, 5));

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(screen.getByText("1 de 5 pessoas")).toBeInTheDocument();
    expect(screen.getByText("Os convites pendentes contam.")).toBeInTheDocument();
  });

  it("no limite, avisa e deixa o convite ligado: reenviar para o mesmo e-mail não ocupa outra vaga", async () => {
    montar("admin", ADMIN.email, COM(3, 3));

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(screen.getByText(/chegou ao limite de 3 pessoas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeEnabled();
  });

  it("sem máximo e com uma pessoa só, a contagem fala no singular", async () => {
    montar("admin", ADMIN.email, COM(1, null));

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(screen.getByText("1 pessoa")).toBeInTheDocument();
  });

  it("convidar, cancelar e remover relêem a página, para a faixa e a barra não ficarem velhas; o erro não", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValueOnce({ ok: true, dados: { id: "c9", email: "eva@x.com", papel: "analista", enviadoEm: "16/10/2026", valeAte: "23/10/2026" } });
    cancelarConvite.mockResolvedValueOnce({ ok: true, dados: null });
    removerPessoa.mockResolvedValueOnce({ ok: true, dados: null });
    montar("admin", ADMIN.email, COM(3, 5));
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.type(screen.getByLabelText("E-mail da pessoa"), "eva@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    await user.click(within(linhaDe("caio@x.com")).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));

    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(3));

    convidar.mockResolvedValueOnce({ ok: false, status: 409, erro: "Este e-mail já tem conta no Ledgr." });
    await user.type(screen.getByLabelText("E-mail da pessoa"), "ana@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await screen.findByRole("alert");
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("sem máximo mostra só a contagem, sem barra; sem o campo do /me, não há faixa", async () => {
    montar("admin", ADMIN.email, COM(5, null));
    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(screen.getByText("5 pessoas")).toBeInTheDocument();
    expect(document.querySelector(".faixa-plano-barra")).toBeNull();
  });

  it("sem os limites do /me, não há faixa", async () => {
    montar("admin", ADMIN.email, null);
    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(document.querySelector(".faixa-plano")).toBeNull();
  });

  it("quem só vê a lista (o analista) não recebe a faixa", async () => {
    montar("analista", BIA.email, COM(3, 3));

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    expect(document.querySelector(".faixa-plano")).toBeNull();
  });

  it("o 402 do backend ao convidar mostra o texto dele", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValue({ ok: false, status: 402, erro: "O plano permite até 3 pessoas." });
    montar("admin", ADMIN.email, COM(1, 3));

    await screen.findByText("Bia", { selector: ".equipe-nome" });
    await user.type(screen.getByLabelText("E-mail da pessoa"), "novo@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByText("O plano permite até 3 pessoas.")).toBeInTheDocument();
  });
});

describe("o menu de papel", () => {
  const botaoDe = (nome: string) => within(linhaDe(nome)).queryByRole("button", { name: new RegExp(`^Papel de ${nome}`) });
  const COM_GIL = { ok: true, dados: { pessoas: [ADMIN, GESTOR, BIA], convites: [] } };

  beforeEach(() => {
    carregarEquipe.mockResolvedValue(COM_GIL);
  });

  it("o admin tem o menu na linha da Bia e do Gil, e não na própria nem na de outro admin", async () => {
    carregarEquipe.mockResolvedValue({ ok: true, dados: { pessoas: [ADMIN, GESTOR, BIA, { id: "u4", nome: "Duda", email: "duda@x.com", papel: "admin" }], convites: [] } });
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    expect(botaoDe("Bia")).toBeInTheDocument();
    expect(botaoDe("Gil")).toBeInTheDocument();
    expect(botaoDe("Ana")).not.toBeInTheDocument();
    expect(botaoDe("Duda")).not.toBeInTheDocument();
    expect(within(linhaDe("Ana")).getByText("Administrador")).toBeInTheDocument();
  });

  it.each<[Papel, string]>([
    ["gestor", GESTOR.email],
    ["analista", BIA.email],
  ])("o %s só vê a etiqueta do papel, sem menu", async (papel, email) => {
    montar(papel, email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    expect(screen.queryByRole("button", { name: /^Papel de/ })).not.toBeInTheDocument();
    expect(within(linhaDe("Bia")).getByText("Analista")).toBeInTheDocument();
  });

  it("o menu abre com Gestor e Analista explicados, o atual marcado, e Tornar administrador depois de um filete", async () => {
    const user = userEvent.setup();
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);

    const menu = screen.getByRole("menu", { name: "Papel de Bia" });
    const gestor = within(menu).getByRole("menuitemradio", { name: /^Gestor/ });
    const analista = within(menu).getByRole("menuitemradio", { name: /^Analista/ });
    expect(gestor).toHaveTextContent("Cadastra empresas, convida analistas, fecha o mês e aprova justificativas.");
    expect(analista).toHaveTextContent("Concilia e justifica divergências. Não fecha o mês nem convida.");
    expect(analista).toHaveAttribute("aria-checked", "true");
    expect(gestor).toHaveAttribute("aria-checked", "false");
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /^Tornar administrador/ })).toBeInTheDocument();
    expect(botaoDe("Bia")).toHaveAttribute("aria-expanded", "true");
  });

  it("escolher o papel que a pessoa já tem fecha o menu e não chama o backend", async () => {
    const user = userEvent.setup();
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(screen.getByRole("menuitemradio", { name: /^Analista/ }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trocarPapel).not.toHaveBeenCalled();
  });

  it("escolher outro papel chama a ação, mostra Salvando… na linha, troca a etiqueta e relê a página", async () => {
    const user = userEvent.setup();
    let concluir: (resposta: unknown) => void = () => {};
    trocarPapel.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(screen.getByRole("menuitemradio", { name: /^Gestor/ }));

    expect(trocarPapel).toHaveBeenCalledWith("u2", "gestor");
    expect(within(linhaDe("Bia")).getByText("Salvando…")).toBeInTheDocument();
    expect(botaoDe("Bia")).toBeDisabled();

    await waitFor(async () => {
      concluir({ ok: true, dados: { ...BIA, papel: "gestor" } });
    });
    await waitFor(() => expect(within(linhaDe("Bia")).getByText("Gestor")).toBeInTheDocument());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("o erro do backend aparece na linha e o papel não muda", async () => {
    const user = userEvent.setup();
    trocarPapel.mockResolvedValue({ ok: false, status: 409, erro: "O admin só muda de papel pela transferência." });
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(screen.getByRole("menuitemradio", { name: /^Gestor/ }));

    expect(await within(linhaDe("Bia")).findByRole("alert")).toHaveTextContent("O admin só muda de papel pela transferência.");
    expect(within(linhaDe("Bia")).getByText("Analista")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("o 403 relê a equipe e o papel de quem está logado (router.refresh), para os controles sumirem", async () => {
    const user = userEvent.setup();
    trocarPapel.mockResolvedValue({ ok: false, status: 403, erro: "Seu papel na conta não permite fazer isso." });
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(screen.getByRole("menuitemradio", { name: /^Gestor/ }));

    await waitFor(() => expect(carregarEquipe).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("o 404 relê a equipe e a mensagem continua visível no topo, mesmo sem a linha da pessoa", async () => {
    const user = userEvent.setup();
    trocarPapel.mockResolvedValue({ ok: false, status: 404, erro: "Essa pessoa não está mais na conta." });
    carregarEquipe
      .mockResolvedValueOnce({ ok: true, dados: { pessoas: [ADMIN, BIA], convites: [CONVITE] } })
      .mockResolvedValueOnce({ ok: true, dados: { pessoas: [ADMIN], convites: [CONVITE] } });
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(screen.getByRole("menuitemradio", { name: /^Gestor/ }));

    await waitFor(() => expect(carregarEquipe).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Bia", { selector: ".equipe-nome" })).not.toBeInTheDocument());
    expect(screen.getByText("Essa pessoa não está mais na conta.")).toBeInTheDocument();
  });

  it("sessão vencida leva ao login, sem erro preso na linha", async () => {
    const user = userEvent.setup();
    trocarPapel.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." });
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(screen.getByRole("menuitemradio", { name: /^Gestor/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(within(linhaDe("Bia")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Esc e um clique fora fecham o menu; Esc devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(botaoDe("Bia")).toHaveFocus();

    await user.click(botaoDe("Bia")!);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("o foco entra no papel atual e as setas andam pelos itens", async () => {
    const user = userEvent.setup();
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    expect(screen.getByRole("menuitemradio", { name: /^Analista/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /^Tornar administrador/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: /^Gestor/ })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: /^Tornar administrador/ })).toHaveFocus();
  });

  it("só um menu fica aberto por vez", async () => {
    const user = userEvent.setup();
    montar("admin", ADMIN.email, null, false);
    await screen.findByText("Bia", { selector: ".equipe-nome" });

    await user.click(botaoDe("Bia")!);
    await user.click(botaoDe("Gil")!);

    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu", { name: "Papel de Gil" })).toBeInTheDocument();
  });
});

describe("a transferência da administração", () => {
  const PESSOAS_DEPOIS = [
    { ...ADMIN, papel: "gestor" },
    { ...BIA, papel: "admin" },
  ];

  /** Abre a janela pelo menu de papel da Bia. */
  async function abrirJanela(temSenha = true) {
    const user = userEvent.setup();
    montar("admin", ADMIN.email, null, false, temSenha);
    await screen.findByText("Bia", { selector: ".equipe-nome" });
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: /^Papel de Bia/ }));
    await user.click(screen.getByRole("menuitem", { name: /^Tornar administrador/ }));
    return { user, janela: screen.getByRole("dialog", { name: "Transferir administração" }) };
  }

  it("abre uma janela modal que avisa o que muda, e o menu fecha", async () => {
    const { janela } = await abrirJanela();

    expect(janela).toHaveClass("espia", "modal-suave");
    expect(
      within(janela).getByText("Bia passa a ser o administrador da conta e você passa a ser Gestor. Só o novo administrador pode desfazer isso."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("na conta com senha, a senha é obrigatória e vai ao backend", async () => {
    transferirAdmin.mockResolvedValue({ ok: true, dados: PESSOAS_DEPOIS });
    const { user, janela } = await abrirJanela();

    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));
    expect(within(janela).getByText("Digite a sua senha atual.")).toBeInTheDocument();
    expect(transferirAdmin).not.toHaveBeenCalled();

    await user.type(within(janela).getByLabelText("Senha atual"), "segredo");
    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    expect(transferirAdmin).toHaveBeenCalledWith("u2", "segredo");
  });

  it("na conta só do Google não há campo de senha e a ação recebe null", async () => {
    transferirAdmin.mockResolvedValue({ ok: true, dados: PESSOAS_DEPOIS });
    const { user, janela } = await abrirJanela(false);

    expect(within(janela).queryByLabelText("Senha atual")).not.toBeInTheDocument();
    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    expect(transferirAdmin).toHaveBeenCalledWith("u2", null);
  });

  it("a senha errada (400) aparece sob o campo e a janela continua aberta", async () => {
    transferirAdmin.mockResolvedValue({ ok: false, status: 400, erro: "Senha atual incorreta." });
    const { user, janela } = await abrirJanela();

    await user.type(within(janela).getByLabelText("Senha atual"), "errada");
    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    const mensagem = await within(janela).findByText("Senha atual incorreta.");
    expect(within(janela).getByLabelText("Senha atual")).toHaveAttribute("aria-describedby", mensagem.closest("[role=alert]")!.id);
    expect(screen.getByRole("dialog", { name: "Transferir administração" })).toBeInTheDocument();
  });

  it.each([
    [409, "Entre de novo com o Google para confirmar."],
    [409, "O papel de admin já foi transferido."],
    [429, "Muitas tentativas. Tente de novo em 1 minuto."],
    [0, "Não foi possível falar com o servidor."],
  ])("o erro %s (%s) aparece na janela, que continua aberta", async (status, erro) => {
    transferirAdmin.mockResolvedValue({ ok: false, status, erro });
    const { user, janela } = await abrirJanela(false);

    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    expect(await within(janela).findByRole("alert")).toHaveTextContent(erro);
  });

  it("dois envios no mesmo instante chamam a ação uma vez só; o botão diz Transferindo… e fica desligado", async () => {
    let concluir: (resposta: unknown) => void = () => {};
    transferirAdmin.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const { user, janela } = await abrirJanela();
    await user.type(within(janela).getByLabelText("Senha atual"), "segredo");
    const form = within(janela).getByRole("form", { name: "Transferir administração" }) as HTMLFormElement;

    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    expect(transferirAdmin).toHaveBeenCalledTimes(1);
    expect(within(janela).getByRole("button", { name: "Transferindo…" })).toBeDisabled();
    await act(async () => concluir({ ok: true, dados: PESSOAS_DEPOIS }));
  });

  it("concluir fecha a janela, troca a lista, relê a página e avisa quem é o administrador agora", async () => {
    transferirAdmin.mockResolvedValue({ ok: true, dados: PESSOAS_DEPOIS });
    const { user, janela } = await abrirJanela();

    await user.type(within(janela).getByLabelText("Senha atual"), "segredo");
    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("status")).toHaveTextContent("Bia agora é o administrador da conta. Você é Gestor.");
    expect(within(linhaDe("Bia")).getByText("Administrador")).toBeInTheDocument();
    expect(within(linhaDe("Ana")).getByText("Gestor")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("Esc, Cancelar e um clique no fundo fecham a janela sem chamar a ação", async () => {
    const { user } = await abrirJanela();
    const abrirDeNovo = async () => {
      await user.click(within(linhaDe("Bia")).getByRole("button", { name: /^Papel de Bia/ }));
      await user.click(screen.getByRole("menuitem", { name: /^Tornar administrador/ }));
    };

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrirDeNovo();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrirDeNovo();
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(transferirAdmin).not.toHaveBeenCalled();
  });

  it("sessão vencida leva ao login", async () => {
    transferirAdmin.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." });
    const { user, janela } = await abrirJanela(false);

    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it.each([
    [403, "Seu papel na conta não permite fazer isso."],
    [404, "Essa pessoa não está mais na conta."],
  ])("o %s fecha a janela, mostra o erro na aba e relê a equipe", async (status, erro) => {
    transferirAdmin.mockResolvedValue({ ok: false, status, erro });
    const { user, janela } = await abrirJanela(false);

    await user.click(within(janela).getByRole("button", { name: "Transferir administração" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(erro);
    await waitFor(() => expect(carregarEquipe).toHaveBeenCalledTimes(2));
  });
});
