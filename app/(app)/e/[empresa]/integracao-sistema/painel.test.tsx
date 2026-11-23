import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PainelDeIntegracao } from "./painel";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/roteador", () => ({
  useRoteador: () => ({ push, refresh }),
}));

const carregarIntegracaoSistema = vi.fn();
const salvarIntegracaoSistema = vi.fn();
const removerIntegracaoSistema = vi.fn();
vi.mock("./acoes", () => ({
  carregarIntegracaoSistema: () => carregarIntegracaoSistema(),
  salvarIntegracaoSistema: (url: string, chave: string) => salvarIntegracaoSistema(url, chave),
  removerIntegracaoSistema: () => removerIntegracaoSistema(),
}));

const NAO_CONFIGURADA = {
  configurada: false,
  adaptador: null,
  url: null,
  chavePrefixo: null,
  atualizadaEm: null,
  atualizadaPor: null,
};

const CONFIGURADA = {
  configurada: true,
  adaptador: "ledgr_v1",
  url: "https://erp.telhacerta.com.br",
  chavePrefixo: "erp_9f8e",
  atualizadaEm: "2026-11-22T15:30:00Z",
  atualizadaPor: "Ana Financeiro",
};

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  carregarIntegracaoSistema.mockReset();
  salvarIntegracaoSistema.mockReset();
  removerIntegracaoSistema.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PainelDeIntegracao", () => {
  it("salva URL e chave via PUT, limpa o campo da chave e nunca a expõe no DOM, localStorage, URL ou console", async () => {
    const segredo = "erp_9f8e_segredo_absoluto_2026";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    carregarIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: NAO_CONFIGURADA });
    salvarIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: CONFIGURADA });

    const user = userEvent.setup();
    render(<PainelDeIntegracao />);

    const campoUrl = await screen.findByLabelText("URL do sistema");
    const campoChave = screen.getByLabelText("Chave de acesso");
    expect(screen.getByText("Nenhuma integração configurada para esta empresa.")).toBeInTheDocument();
    expect(campoUrl).toHaveAttribute("placeholder", "https://sistema.suaempresa.com.br");
    expect(campoUrl).toHaveAccessibleDescription(/Endereço base do sistema de gestão/i);
    expect(campoChave).toHaveAttribute("type", "password");
    expect(campoChave).toHaveAttribute("autocomplete", "one-time-code");

    await user.type(campoUrl, CONFIGURADA.url);
    await user.type(campoChave, segredo);
    await user.click(screen.getByRole("button", { name: "Salvar integração" }));

    expect(salvarIntegracaoSistema).toHaveBeenCalledWith(CONFIGURADA.url, segredo);
    expect(await screen.findByRole("status")).toHaveTextContent("Integração salva.");
    expect(screen.getByText(CONFIGURADA.url)).toBeInTheDocument();
    expect(screen.getByText("erp_9f8e…")).toBeInTheDocument();
    expect(screen.getByText(/Atualizada em .* por Ana Financeiro\./)).toBeInTheDocument();
    // a chave volta vazia e não aparece em lugar nenhum
    expect(campoChave).toHaveValue("");
    expect(campoChave).toHaveAttribute("placeholder", "Cole uma chave nova para trocar");
    expect(document.body.textContent).not.toContain(segredo);
    expect(window.location.href).not.toContain(segredo);
    expect(window.localStorage.length).toBe(0);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("trocar a URL sobre uma configuração existente exige colar a chave de novo", async () => {
    carregarIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: CONFIGURADA });
    const user = userEvent.setup();
    render(<PainelDeIntegracao />);

    const campoUrl = await screen.findByLabelText("URL do sistema");
    expect(campoUrl).toHaveValue(CONFIGURADA.url);
    expect(screen.getByLabelText("Chave de acesso")).toHaveValue("");

    await user.clear(campoUrl);
    await user.type(campoUrl, "https://outro-erp.telhacerta.com.br/extrato");
    await user.click(screen.getByRole("button", { name: "Salvar integração" }));

    expect(salvarIntegracaoSistema).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Cole a chave de acesso/);
  });

  it("mostra 422 do PUT ao lado do campo com o texto do backend e conta inativa no erro geral", async () => {
    carregarIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: NAO_CONFIGURADA });
    salvarIntegracaoSistema
      .mockResolvedValueOnce({ ok: false, status: 422, campo: "url", erro: "O endereço precisa usar HTTPS." })
      .mockResolvedValueOnce({ ok: false, status: 403, codigo: "conta_inativa", erro: "Esta conta está inativa." });

    const user = userEvent.setup();
    render(<PainelDeIntegracao />);

    const campoUrl = await screen.findByLabelText("URL do sistema");
    const campoChave = screen.getByLabelText("Chave de acesso");
    await user.type(campoUrl, "http://erp.local");
    await user.type(campoChave, "segredo-nao-ecoado");
    await user.click(screen.getByRole("button", { name: "Salvar integração" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("O endereço precisa usar HTTPS.");
    expect(campoUrl).toHaveAttribute("aria-invalid", "true");
    expect(document.body.textContent).not.toContain("segredo-nao-ecoado");

    await user.click(screen.getByRole("button", { name: "Salvar integração" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta conta está inativa.");
  });

  it("remover integração pede confirmação, chama DELETE e volta ao estado não configurada", async () => {
    carregarIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: CONFIGURADA });
    removerIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: null });

    const user = userEvent.setup();
    render(<PainelDeIntegracao />);

    await user.click(await screen.findByRole("button", { name: "Remover integração" }));
    expect(removerIntegracaoSistema).not.toHaveBeenCalled();
    expect(screen.getByText(/deixará de importar o extrato direto/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover de vez" }));

    expect(removerIntegracaoSistema).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Integração removida.");
    expect(screen.queryByText("Integração configurada")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover integração" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("URL do sistema")).toHaveValue("");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("401 ao carregar leva ao login; outra falha oferece Tentar de novo", async () => {
    carregarIntegracaoSistema.mockResolvedValueOnce({ ok: false, status: 401, erro: "Sessão expirada." });
    const { unmount } = render(<PainelDeIntegracao />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    unmount();

    carregarIntegracaoSistema
      .mockResolvedValueOnce({ ok: false, status: 0, erro: "Sem servidor" })
      .mockResolvedValueOnce({ ok: true, dados: NAO_CONFIGURADA });
    const user = userEvent.setup();
    render(<PainelDeIntegracao />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem servidor");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByLabelText("URL do sistema")).toBeInTheDocument();
  });

  it("chave curta sem prefixo exibe 'Chave: salva' e nunca mostra a chave inteira no DOM", async () => {
    const chaveCurta = "abc12";
    carregarIntegracaoSistema.mockResolvedValueOnce({ ok: true, dados: NAO_CONFIGURADA });
    salvarIntegracaoSistema.mockResolvedValueOnce({
      ok: true,
      dados: { ...CONFIGURADA, chavePrefixo: null },
    });

    const user = userEvent.setup();
    render(<PainelDeIntegracao />);

    await user.type(await screen.findByLabelText("URL do sistema"), CONFIGURADA.url);
    await user.type(screen.getByLabelText("Chave de acesso"), chaveCurta);
    await user.click(screen.getByRole("button", { name: "Salvar integração" }));

    expect(await screen.findByText("Chave: salva")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(chaveCurta);
  });
});
