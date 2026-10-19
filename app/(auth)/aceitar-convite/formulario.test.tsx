import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AceitarConvite } from "./formulario";

// as Server Actions são a fronteira com o backend (/convites/*, backend #69)
const consultarConvite = vi.fn();
const aceitarConvite = vi.fn();
const sairParaAceitarConvite = vi.fn();
const aceitarConviteComGoogle = vi.fn();
vi.mock("../acoes", () => ({
  consultarConvite: (...args: unknown[]) => consultarConvite(...args),
  aceitarConvite: (...args: unknown[]) => aceitarConvite(...args),
  sairParaAceitarConvite: (...args: unknown[]) => sairParaAceitarConvite(...args),
  aceitarConviteComGoogle: (...args: unknown[]) => aceitarConviteComGoogle(...args),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const CONVITE = { email: "ana@x.com", razaoSocial: "Padaria Ltda", valeAte: "23/10/2026" };
const SEM_GOOGLE = { ligado: false, erro: null, convite: null };
const INVALIDO = "Este convite expirou ou já foi usado. Peça um novo a quem convidou.";

function abrirLink(caminho: string) {
  window.history.replaceState(null, "", caminho);
}

async function preencher(nome: string, senha: string, confirmacao = senha) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Seu nome"), nome);
  await user.type(screen.getByLabelText("Senha"), senha);
  await user.type(screen.getByLabelText("Repita a senha"), confirmacao);
  await user.click(screen.getByRole("button", { name: "Criar conta e entrar" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  consultarConvite.mockResolvedValue({ ok: true, convite: CONVITE });
  aceitarConvite.mockResolvedValue({ ok: true, entrou: true });
  sairParaAceitarConvite.mockResolvedValue(undefined);
  // a action sai redirecionando para o Google: no navegador, a promessa não volta
  aceitarConviteComGoogle.mockReturnValue(new Promise(() => {}));
  abrirLink("/aceitar-convite#token=tok");
});

afterEach(() => {
  abrirLink("/");
});

describe("AceitarConvite", () => {
  it("lê o token, apaga o fragmento e mostra o convite", async () => {
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    expect(await screen.findByRole("heading", { name: "Entrar na Padaria Ltda" })).toBeInTheDocument();
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
    expect(screen.getByText("O convite vale até 23/10/2026")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/aceitar-convite");
    expect(consultarConvite).toHaveBeenCalledWith("tok");
  });

  it("sem token não consulta nem mostra formulário", async () => {
    abrirLink("/aceitar-convite");
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(consultarConvite).not.toHaveBeenCalled();
  });

  it("convite inválido não mostra formulário", async () => {
    consultarConvite.mockResolvedValue({ ok: false, erro: "convite_invalido" });
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("um novo render depois de apagar o fragmento não perde o convite", async () => {
    const { rerender } = render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);
    expect(await screen.findByLabelText("Senha")).toBeInTheDocument();

    rerender(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(consultarConvite).toHaveBeenCalledTimes(1);
  });

  it("valida a senha como o cadastro antes de aceitar", async () => {
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    await preencher("Ana", "curta");

    expect(await screen.findByText("A senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(aceitarConvite).not.toHaveBeenCalled();
  });

  it("pede o nome", async () => {
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Senha"), "senha-boa-1");
    await user.type(screen.getByLabelText("Repita a senha"), "senha-boa-1");
    await user.click(screen.getByRole("button", { name: "Criar conta e entrar" }));

    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(aceitarConvite).not.toHaveBeenCalled();
  });

  it("aceita e vai para a Visão geral", async () => {
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    await preencher(" Ana ", "senha-boa-1");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/visao-geral"));
    expect(aceitarConvite).toHaveBeenCalledWith("tok", "ana@x.com", "Ana", "senha-boa-1");
  });

  it("conta criada sem a sessão aberta vai para o login", async () => {
    aceitarConvite.mockResolvedValue({ ok: true, entrou: false });
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    await preencher("Ana", "senha-boa-1");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("e-mail já cadastrado manda para o login", async () => {
    aceitarConvite.mockResolvedValue({ ok: false, erro: "email_cadastrado" });
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    await preencher("Ana", "senha-boa-1");

    expect(await screen.findByText("Este e-mail já tem conta no Ledgr. Entre com ela.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("convite que venceu no caminho vira a tela de convite inválido", async () => {
    aceitarConvite.mockResolvedValue({ ok: false, erro: "convite_invalido" });
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    await preencher("Ana", "senha-boa-1");

    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
  });

  it("muitas tentativas pede para esperar", async () => {
    aceitarConvite.mockResolvedValue({ ok: false, erro: "muitas_tentativas" });
    render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);

    await preencher("Ana", "senha-boa-1");

    expect(await screen.findByText("Muitas tentativas seguidas. Espere um minuto e tente de novo.")).toBeInTheDocument();
  });

  it("com email_diferente, pede o e-mail certo do convite e oferece o Google de novo", async () => {
    const user = userEvent.setup();
    abrirLink("/aceitar-convite?google=email_diferente");
    render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: "email_diferente", convite: CONVITE }} />);

    expect(await screen.findByText("Entre no Google com ana@x.com para aceitar.")).toBeInTheDocument();
    expect(consultarConvite).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Aceitar com Google" }));
    // depois da volta do Google, o token está no cookie, não na memória
    expect(aceitarConviteComGoogle).toHaveBeenCalledWith("");
  });

  it("com erro do Google e sem convite no cookie, mostra convite inválido", async () => {
    render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: "email_diferente", convite: null }} />);

    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("com email_cadastrado, manda entrar pelo login", async () => {
    render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: "email_cadastrado", convite: CONVITE }} />);

    expect(await screen.findByText("Este e-mail já tem conta no Ledgr. Entre com ela.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("muitas tentativas no Google usa o texto do login pelo Google", async () => {
    render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: "muitas_tentativas", convite: CONVITE }} />);

    expect(await screen.findByText("Muitas tentativas seguidas agora. Espere um minuto e tente de novo.")).toBeInTheDocument();
  });

  it("o botão do Google só aparece ligado", async () => {
    const { unmount } = render(<AceitarConvite conectadoComo={null} google={SEM_GOOGLE} />);
    expect(await screen.findByLabelText("Senha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar com Google" })).not.toBeInTheDocument();
    expect(screen.queryByText("ou")).not.toBeInTheDocument();
    unmount();

    abrirLink("/aceitar-convite#token=tok");
    render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: null, convite: null }} />);
    expect(await screen.findByRole("button", { name: "Aceitar com Google" })).toBeInTheDocument();
    expect(screen.getByText("ou")).toBeInTheDocument();
  });

  it("Aceitar com Google manda o token guardado", async () => {
    const user = userEvent.setup();
    render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: null, convite: null }} />);

    await user.click(await screen.findByRole("button", { name: "Aceitar com Google" }));

    expect(aceitarConviteComGoogle).toHaveBeenCalledWith("tok");
  });

  it("conectado em outra conta pede para sair primeiro, e Sair e continuar volta ao convite", async () => {
    const user = userEvent.setup();
    render(<AceitarConvite conectadoComo="bia@y.com" google={SEM_GOOGLE} />);

    expect(
      await screen.findByText("Você está conectado como bia@y.com. Para aceitar este convite, saia primeiro."),
    ).toBeInTheDocument();
    expect(consultarConvite).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");

    await user.click(screen.getByRole("button", { name: "Sair e continuar" }));

    expect(await screen.findByLabelText("Senha")).toBeInTheDocument();
    expect(sairParaAceitarConvite).toHaveBeenCalledTimes(1);
    expect(consultarConvite).toHaveBeenCalledWith("tok");
  });
});
