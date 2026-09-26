import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CadastroPage from "./page";
import { PASSOS } from "./passos";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// o fim do cadastro é uma Server Action (POST /register e já entra); aqui ela só
// devolve o que o servidor decidiu
const cadastrar = vi.fn();
vi.mock("../acoes", () => ({
  cadastrar: (...args: unknown[]) => cadastrar(...args),
}));

type Usuario = ReturnType<typeof userEvent.setup>;

async function preencher(user: Usuario, valores: Record<string, string>) {
  for (const [rotulo, valor] of Object.entries(valores)) {
    await user.type(screen.getByLabelText(rotulo), valor);
  }
}

async function continuar(user: Usuario) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

const ACESSO = { "Nome completo": "Ana Souza", "E-mail": "financeiro@telhacerta.com.br", Senha: "conciliar2026" };
const EMPRESA = { "Razão social": "Telha Certa Ltda", CNPJ: "12.345.678/0001-95" };
const BANCO = { "Banco e agência": "Sicredi · ag. 1234", "Conta corrente": "45678-9" };

function titulo() {
  return screen.getByRole("heading", { level: 1 });
}

describe("CadastroPage", () => {
  beforeEach(() => {
    push.mockClear();
    cadastrar.mockReset();
    cadastrar.mockResolvedValue({ ok: true, entrou: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts on the access step with name, e-mail and password", () => {
    render(<CadastroPage />);
    expect(titulo()).toHaveTextContent(PASSOS[0].titulo);
    expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    // o mínimo da senha aparece antes do erro, logo abaixo do campo
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Pelo menos 8 caracteres");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Etapas do cadastro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("types the step title, with the underline following it and then returning to its resting width", () => {
    vi.useFakeTimers();
    try {
      render(<CadastroPage />);
      const h1 = titulo();
      const linha = screen.getByTestId("linha-titulo");
      expect(h1).toHaveAttribute("data-digitando", "true");
      expect(h1).toHaveAccessibleName(PASSOS[0].titulo);

      // dois passos: o timer de volta do traço só é agendado depois que o React processa o fim da digitação
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(h1).toHaveAttribute("data-digitando", "false");
      expect(linha).toHaveAttribute("data-estado", "cheia");

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(linha).toHaveAttribute("data-estado", "repouso");
      expect(linha).toHaveStyle({ width: "68px" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("points out empty and invalid access fields next to each one and stays on the step", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, { "E-mail": "financeiro@", Senha: "curta" });
    await continuar(user);

    expect(screen.getByLabelText("Nome completo")).toHaveAccessibleDescription("Informe seu nome.");
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("Confira o e-mail: parece incompleto.");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("A senha precisa ter pelo menos 8 caracteres.");
    expect(titulo()).toHaveTextContent(PASSOS[0].titulo);
  });

  it("walks through the company, bank and management-system steps from the Claude Design", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    expect(titulo()).toHaveTextContent("Vamos cadastrar a empresa.");
    expect(screen.getByText("Passo I de III")).toBeInTheDocument();
    expect(screen.getByText(PASSOS[1].dicaTitulo ?? "")).toBeInTheDocument();

    await preencher(user, EMPRESA);
    await continuar(user);
    expect(titulo()).toHaveTextContent("Qual banco você vai conciliar?");
    expect(screen.getByText("Passo II de III")).toBeInTheDocument();

    await preencher(user, BANCO);
    await continuar(user);
    expect(titulo()).toHaveTextContent("E o sistema de gestão?");
    expect(screen.getByText("Passo III de III")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail do responsável")).toHaveValue("financeiro@telhacerta.com.br");
    expect(screen.getByLabelText("Sistema de gestão")).toHaveAttribute("placeholder", "Omie, Bling, Tiny, outro…");
    expect(screen.getByRole("button", { name: "Concluir e subir extratos" })).toBeInTheDocument();
  });

  it("requires the fields of each step before moving on", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    await continuar(user);

    expect(titulo()).toHaveTextContent("Vamos cadastrar a empresa.");
    expect(screen.getByLabelText("Razão social")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("CNPJ")).toHaveAttribute("aria-invalid", "true");
  });

  it("marks the password requirement as met while typing", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    const requisito = screen.getByTestId("requisito-senha");
    expect(requisito).toHaveAttribute("data-atendido", "false");

    await user.type(screen.getByLabelText("Senha"), "conciliar");
    expect(requisito).toHaveAttribute("data-atendido", "true");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Pelo menos 8 caracteres (atendido)");
  });

  it("toggles the password visibility with the mascot eye, as in the login", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  });

  it("asks for consent to the terms and privacy policy on the access step only", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    const consentimento = screen.getByText(/Ao continuar, você aceita os/);
    expect(within(consentimento).getByRole("link", { name: "Termos" })).toBeInTheDocument();
    expect(within(consentimento).getByRole("link", { name: "Política de privacidade" })).toBeInTheDocument();

    await preencher(user, ACESSO);
    await continuar(user);
    expect(screen.queryByText(/Ao continuar, você aceita os/)).not.toBeInTheDocument();
  });

  it("formats the CNPJ while typing and checks that it has 14 characters", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    await preencher(user, { "Razão social": "Telha Certa Ltda", CNPJ: "123456780001" });
    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.345.678/0001");
    await continuar(user);
    expect(screen.getByLabelText("CNPJ")).toHaveAccessibleDescription("O CNPJ tem 14 caracteres. Confira o número.");

    await user.type(screen.getByLabelText("CNPJ"), "95");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.345.678/0001-95");
    await continuar(user);
    expect(titulo()).toHaveTextContent("Qual banco você vai conciliar?");
  });

  // o mesmo cálculo do backend: sem ele, o CNPJ errado só aparecia depois dos quatro passos
  it("checks the CNPJ check digits on the company step", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    await preencher(user, { "Razão social": "Telha Certa Ltda", CNPJ: "12.345.678/0001-90" });
    await continuar(user);
    expect(screen.getByLabelText("CNPJ")).toHaveAccessibleDescription("Os dígitos do CNPJ não conferem. Confira o número.");
    expect(titulo()).toHaveTextContent(PASSOS[1].titulo);

    await user.clear(screen.getByLabelText("CNPJ"));
    await user.type(screen.getByLabelText("CNPJ"), "00000000000000");
    await continuar(user);
    expect(screen.getByLabelText("CNPJ")).toHaveAccessibleDescription("Os dígitos do CNPJ não conferem. Confira o número.");
  });

  it("accepts the alphanumeric CNPJ, with letters in upper case", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    await preencher(user, { "Razão social": "Telha Certa Ltda", CNPJ: "12abc34501de35" });
    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.ABC.345/01DE-35");
    expect(screen.getByLabelText("CNPJ")).not.toHaveAttribute("inputmode", "numeric");
    await continuar(user);
    expect(titulo()).toHaveTextContent("Qual banco você vai conciliar?");
  });

  it("does not limit the account field to a numeric keyboard, since account digits can have a dash or an X", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await preencher(user, ACESSO);
    await continuar(user);
    await preencher(user, EMPRESA);
    await continuar(user);
    expect(screen.getByLabelText("Conta corrente")).not.toHaveAttribute("inputmode", "numeric");
  });

  it("shows the step's mascot on the right side, changing as the person moves through the steps", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    const mascote = () => screen.getByTestId("mascote-cadastro").getAttribute("src") ?? "";

    expect(mascote()).toContain("mascote-apresenta");

    await preencher(user, ACESSO);
    await continuar(user);
    expect(mascote()).toContain("mascote-neutro");

    await preencher(user, EMPRESA);
    await continuar(user);
    expect(mascote()).toContain("mascote-explicando");

    await preencher(user, BANCO);
    await continuar(user);
    expect(mascote()).toContain("mascote-comemorando");
  });

  it("goes back to the previous step keeping what was typed", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(titulo()).toHaveTextContent(PASSOS[0].titulo);
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza");
    expect(screen.getByLabelText("E-mail")).toHaveValue("financeiro@telhacerta.com.br");
  });

  async function concluirCadastro(user: Usuario) {
    await preencher(user, ACESSO);
    await continuar(user);
    await preencher(user, EMPRESA);
    await continuar(user);
    await preencher(user, BANCO);
    await continuar(user);
    await user.type(screen.getByLabelText("Sistema de gestão"), "Cigam");
    await user.click(screen.getByRole("button", { name: "Concluir e subir extratos" }));
  }

  it("creates the account with the typed data and opens the statement upload", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/nova"));
    // banco e sistema de gestão o backend ainda não guarda: não saem do navegador
    expect(cadastrar).toHaveBeenCalledWith({
      nome: "Ana Souza",
      email: "financeiro@telhacerta.com.br",
      senha: "conciliar2026",
      razaoSocial: "Telha Certa Ltda",
      cnpj: "12.345.678/0001-95",
    });
  });

  it("sends to the login when the account was created but the session didn't open", async () => {
    cadastrar.mockResolvedValue({ ok: true, entrou: false });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("goes back to the access step when the e-mail already has an account", async () => {
    cadastrar.mockResolvedValue({ ok: false, erro: "email_cadastrado" });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    const email = await screen.findByLabelText("E-mail");
    expect(email).toHaveAccessibleDescription("Já existe conta com este e-mail. Entre pela tela de login.");
    expect(email).toHaveFocus();
    expect(titulo()).toHaveTextContent(PASSOS[0].titulo);
    expect(push).not.toHaveBeenCalled();
  });

  it("goes back to the company step when the CNPJ already has an account", async () => {
    cadastrar.mockResolvedValue({ ok: false, erro: "cnpj_cadastrado" });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    const cnpj = await screen.findByLabelText("CNPJ");
    expect(cnpj).toHaveAccessibleDescription("Esta empresa já tem cadastro no Ledgr.");
    expect(cnpj).toHaveFocus();
    expect(screen.getByLabelText("Razão social")).toHaveValue("Telha Certa Ltda");
  });

  it("points out every field the server refused, starting from the earliest step", async () => {
    cadastrar.mockResolvedValue({ ok: false, erro: "invalido", campos: ["razaoSocial", "email"] });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    const email = await screen.findByLabelText("E-mail");
    expect(email).toHaveAccessibleDescription("Confira o e-mail: o formato não foi aceito.");
    await continuar(user);
    expect(screen.getByLabelText("Razão social")).toHaveAccessibleDescription("Confira a razão social.");
  });

  it("asks to wait, on the last step, when the server limits the signups", async () => {
    cadastrar.mockResolvedValue({ ok: false, erro: "muitas_tentativas" });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitos cadastros seguidos agora. Espere um minuto e tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Concluir e subir extratos" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("recovers the form when the server can't be reached", async () => {
    cadastrar.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir o cadastro. Tente de novo em instantes.",
    );
    expect(screen.getByRole("button", { name: "Concluir e subir extratos" })).toBeEnabled();
  });
});
