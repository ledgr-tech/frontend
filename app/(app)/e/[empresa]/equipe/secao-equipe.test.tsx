import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Papel } from "@/lib/papel";
import type { LimitesDaConta } from "@/lib/limites";
import { EmpresaDaSessao } from "../cabecalho";
import { ProvedorDaConta } from "../conta";
import { useLinhasDaEquipe } from "./secao-equipe";

// as ações são a fronteira com o backend; aqui devolvem o que ele responderia
const carregarEquipe = vi.fn();
const convidar = vi.fn();
const cancelarConvite = vi.fn();
const removerPessoa = vi.fn();
vi.mock("./acoes", () => ({
  carregarEquipe: (...args: unknown[]) => carregarEquipe(...args),
  convidar: (...args: unknown[]) => convidar(...args),
  cancelarConvite: (...args: unknown[]) => cancelarConvite(...args),
  removerPessoa: (...args: unknown[]) => removerPessoa(...args),
}));

vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: async () => true }));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ADMIN = { id: "u1", nome: "Ana", email: "ana@x.com", papel: "admin" };
const BIA = { id: "u2", nome: "Bia", email: "bia@x.com", papel: "analista" };
const GESTOR = { id: "u3", nome: "Gil", email: "gil@x.com", papel: "gestor" };
const CONVITE = { id: "c1", email: "caio@x.com", papel: "analista", enviadoEm: "16/10/2026", valeAte: "23/10/2026" };

/** As linhas do hook como a janela de Configurações as mostra: título, descrição e controle. */
function Linhas({ papel, email }: { papel: Papel; email: string }) {
  const linhas = useLinhasDaEquipe({ aberta: true, papel, email });
  return (
    <ul>
      {linhas.map((linha) => (
        <li key={linha.chave ?? linha.titulo}>
          <span className="titulo">{linha.titulo}</span>
          {linha.descricao && <span>{linha.descricao}</span>}
          {linha.controle}
        </li>
      ))}
    </ul>
  );
}

function montar(papel: Papel = "admin", email = ADMIN.email, limites: LimitesDaConta | null = null) {
  render(
    <EmpresaDaSessao value="Padaria Ltda">
      <ProvedorDaConta preferencias={null} limites={limites} papel={papel}>
        <Linhas papel={papel} email={email} />
      </ProvedorDaConta>
    </EmpresaDaSessao>,
  );
}

/** A linha inteira de um título (uma pessoa, um convite). */
function linhaDe(titulo: string) {
  return screen.getByText(titulo, { selector: ".titulo" }).closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  carregarEquipe.mockResolvedValue({ ok: true, dados: { pessoas: [ADMIN, BIA], convites: [CONVITE] } });
});

describe("useLinhasDaEquipe", () => {
  it("abre dizendo quem tem acesso à empresa", async () => {
    montar();
    expect(await screen.findByText("Quem tem acesso à Padaria Ltda. Cada pessoa entra com o próprio e-mail.")).toBeInTheDocument();
  });

  it("o admin vê convidar, pendentes, cancelar e remover", async () => {
    montar();

    expect(await screen.findByText("Bia")).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledWith("admin");
    // só um Remover: o da Bia; a própria linha e a do administrador não têm
    expect(screen.getAllByRole("button", { name: "Remover" })).toHaveLength(1);
    expect(within(linhaDe("Bia")).getByRole("button", { name: "Remover" })).toBeInTheDocument();
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

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledWith("analista");
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail da pessoa")).not.toBeInTheDocument();
    expect(
      screen.getByText("Só o administrador e o gestor convidam pessoas; só o administrador remove."),
    ).toBeInTheDocument();
    expect(within(linhaDe("Bia")).getByText("você")).toBeInTheDocument();
  });

  it("o gestor convida e cancela convite, mas não remove ninguém", async () => {
    carregarEquipe.mockResolvedValue({ ok: true, dados: { pessoas: [ADMIN, GESTOR, BIA], convites: [CONVITE] } });
    montar("gestor", GESTOR.email);

    expect(await screen.findByText("Bia")).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledWith("gestor");
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(within(linhaDe("Gil")).getByText("Gestor")).toBeInTheDocument();
    expect(within(linhaDe("caio@x.com")).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    // o gestor só convida analista: a lista de papéis tem uma opção e fica travada
    const papel = screen.getByLabelText("Papel");
    expect(papel).toBeDisabled();
    expect(papel).toHaveValue("analista");
  });

  it("o admin escolhe entre gestor e analista ao convidar, e o convite sai com o papel", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValue({
      ok: true,
      dados: { id: "c3", email: "eva@x.com", papel: "analista", enviadoEm: "16/10/2026", valeAte: "23/10/2026" },
    });
    montar();

    const papel = await screen.findByLabelText("Papel");
    expect(within(papel).getAllByRole("option").map((opcao) => opcao.textContent)).toEqual(["Gestor", "Analista"]);
    expect(papel).toHaveValue("gestor");
    await user.selectOptions(papel, "analista");
    await user.type(screen.getByLabelText("E-mail da pessoa"), "eva@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(convidar).toHaveBeenCalledWith("eva@x.com", "analista");
    expect(await screen.findByText("eva@x.com", { selector: ".titulo" })).toBeInTheDocument();
  });

  it("confirma a remoção na própria linha e tira a pessoa da lista", async () => {
    const user = userEvent.setup();
    removerPessoa.mockResolvedValue({ ok: true, dados: null });
    montar();

    await user.click(within(await screen.findByText("Bia").then(() => linhaDe("Bia"))).getByRole("button", { name: "Remover" }));
    const linha = linhaDe("Bia");
    expect(
      within(linha).getByText(
        "Bia perde o acesso na hora. As decisões que registrou continuam no histórico com o nome dela.",
      ),
    ).toBeInTheDocument();
    await user.click(within(linha).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByText("Bia")).not.toBeInTheDocument());
    expect(removerPessoa).toHaveBeenCalledTimes(1);
    expect(removerPessoa).toHaveBeenCalledWith("u2");
  });

  it("desistir da remoção volta a linha como estava", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(within(await screen.findByText("Bia").then(() => linhaDe("Bia"))).getByRole("button", { name: "Remover" }));
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Cancelar" }));

    expect(within(linhaDe("Bia")).getByRole("button", { name: "Remover" })).toBeInTheDocument();
    expect(removerPessoa).not.toHaveBeenCalled();
  });

  it("trava os botões enquanto a ação roda", async () => {
    const user = userEvent.setup();
    removerPessoa.mockReturnValue(new Promise(() => {}));
    convidar.mockReturnValue(new Promise(() => {}));
    montar();

    await user.click(within(await screen.findByText("Bia").then(() => linhaDe("Bia"))).getByRole("button", { name: "Remover" }));
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
    convidar.mockResolvedValue({
      ok: true,
      dados: { id: "c2", email: "dani@x.com", papel: "gestor", enviadoEm: "16/10/2026", valeAte: "23/10/2026" },
    });
    montar();

    await user.type(await screen.findByLabelText("E-mail da pessoa"), "dani@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Convite enviado para dani@x.com. O link vale até 23/10/2026.",
    );
    expect(screen.getByLabelText("E-mail da pessoa")).toHaveValue("");
    const titulos = screen.getAllByText(/@x\.com$/, { selector: ".titulo" }).map((elemento) => elemento.textContent);
    expect(titulos).toEqual(["dani@x.com", "caio@x.com"]);
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

    await user.click(within(await screen.findByText("caio@x.com").then(() => linhaDe("caio@x.com"))).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByText("caio@x.com")).not.toBeInTheDocument());
    expect(cancelarConvite).toHaveBeenCalledWith("c1");
    expect(screen.queryByText("Convites pendentes")).not.toBeInTheDocument();
  });

  it("enquanto carrega, diz que está carregando", () => {
    carregarEquipe.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByText("Carregando a equipe…")).toBeInTheDocument();
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

    expect(await screen.findByText("Bia")).toBeInTheDocument();
    expect(carregarEquipe).toHaveBeenCalledTimes(2);
  });

  it("403 numa ação avisa e carrega a equipe de novo", async () => {
    const user = userEvent.setup();
    cancelarConvite.mockResolvedValue({ ok: false, status: 403, erro: "Só o administrador pode fazer isso." });
    montar();

    await user.click(within(await screen.findByText("caio@x.com").then(() => linhaDe("caio@x.com"))).getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Só o administrador pode fazer isso.");
    await waitFor(() => expect(carregarEquipe).toHaveBeenCalledTimes(2));
  });

  it("401 em qualquer ação vai para o login, sem erro preso na tela", async () => {
    const user = userEvent.setup();
    removerPessoa.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." });
    montar();

    await user.click(within(await screen.findByText("Bia").then(() => linhaDe("Bia"))).getByRole("button", { name: "Remover" }));
    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("o limite de pessoas do plano", () => {
  const COM = (usadas: number, maximo: number | null): LimitesDaConta => ({ empresas: null, usuarios: { usadas, maximo } });

  it("perto do limite, avisa acima do convite", async () => {
    montar("admin", ADMIN.email, COM(2, 3));

    await screen.findByText("Bia", { selector: ".titulo" });
    const titulos = screen.getAllByText(/./, { selector: ".titulo" }).map((no) => no.textContent);
    expect(within(linhaDe("Plano")).getByText("Falta 1 pessoa para o limite do plano.")).toBeInTheDocument();
    expect(titulos.indexOf("Plano")).toBe(titulos.indexOf("Convidar pessoa") - 1);
  });

  it("no limite, avisa e deixa o convite ligado: reenviar para o mesmo e-mail não ocupa outra vaga", async () => {
    montar("admin", ADMIN.email, COM(3, 3));

    await screen.findByText("Bia", { selector: ".titulo" });
    expect(within(linhaDe("Plano")).getByText(/chegou ao limite de 3 pessoas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeEnabled();
  });

  it("com folga, sem limite ou sem o campo do /me, não há linha do plano", async () => {
    for (const limites of [COM(1, 3), COM(5, null), null]) {
      montar("admin", ADMIN.email, limites);
      await screen.findByText("Bia", { selector: ".titulo" });
      expect(screen.queryByText("Plano", { selector: ".titulo" })).not.toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });

  it("quem só vê a lista (o analista) não recebe o aviso de convite", async () => {
    montar("analista", BIA.email, COM(3, 3));

    await screen.findByText("Bia", { selector: ".titulo" });
    expect(screen.queryByText("Plano", { selector: ".titulo" })).not.toBeInTheDocument();
  });

  it("o 402 do backend ao convidar mostra o texto dele", async () => {
    const user = userEvent.setup();
    convidar.mockResolvedValue({ ok: false, status: 402, erro: "O plano permite até 3 pessoas." });
    montar("admin", ADMIN.email, COM(1, 3));

    await screen.findByText("Bia", { selector: ".titulo" });
    await user.type(screen.getByLabelText("E-mail da pessoa"), "novo@x.com");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByText("O plano permite até 3 pessoas.")).toBeInTheDocument();
  });
});
