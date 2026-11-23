import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import { ABRIR_CONFIGURACOES } from "@/lib/eventos";
import type { Papel } from "@/lib/papel";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { ProvedorDaConta } from "../../conta";
import { ImportarDoSistema } from "./importar-do-sistema";

const push = vi.fn();
vi.mock("@/lib/roteador", () => ({
  useRoteador: () => ({ push, refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

const importarDoSistema = vi.fn();
vi.mock("./ia/acoes", () => ({
  importarDoSistema: (de: string, ate: string) => importarDoSistema(de, ate),
}));

const EMPRESA = {
  id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
  razaoSocial: "Telha Certa Ltda",
  nome: "Telha Certa",
  cnpj: "12345678000195",
};

const HOJE = new Date("2026-11-23T12:00:00Z");

const assign = vi.fn();
const localOriginal = window.location;

function montar({
  habilitada = true,
  configurada = true,
  papel = "admin" as Papel,
  temArquivoBanco = false,
} = {}) {
  return render(
    <ProvedorDaEmpresa ativa={EMPRESA} empresas={[EMPRESA]}>
      <ProvedorDaConta
        preferencias={null}
        papel={papel}
        integracaoSistemaHabilitada={habilitada}
        integracaoSistemaConfigurada={configurada}
      >
        <ImportarDoSistema temArquivoBanco={temArquivoBanco} hoje={HOJE} />
      </ProvedorDaConta>
    </ProvedorDaEmpresa>,
  );
}

beforeEach(() => {
  push.mockReset();
  importarDoSistema.mockReset();
  assign.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...localOriginal, assign } });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: localOriginal });
});

describe("ImportarDoSistema", () => {
  it("com a flag desligada não aparece nada", () => {
    const { container } = montar({ habilitada: false, configurada: true });
    expect(container).toBeEmptyDOMElement();
  });

  it("habilitada e não configurada: admin e gestor abrem Configurações › Integração; analista vê aviso sem botão", async () => {
    const user = userEvent.setup();
    const evento = vi.fn();
    window.addEventListener(ABRIR_CONFIGURACOES, evento);

    const { unmount } = montar({ habilitada: true, configurada: false, papel: "gestor" });
    await user.click(screen.getByRole("button", { name: "Configurar a integração" }));
    expect(evento).toHaveBeenCalledTimes(1);
    expect((evento.mock.calls[0][0] as CustomEvent).detail).toEqual({ secao: "integracao" });
    window.removeEventListener(ABRIR_CONFIGURACOES, evento);
    unmount();

    montar({ habilitada: true, configurada: false, papel: "analista" });
    expect(screen.getByText("Peça a quem administra o Ledgr para configurar a integração.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("pré-preenche o mês anterior (F1), manda de/ate do mês escolhido e vai em página inteira para a revisão", async () => {
    const importacaoId = "ea0a9f44-d4d2-4d65-93bf-8494eb235a94";
    importarDoSistema.mockResolvedValueOnce({ ok: true, dados: { importacaoId, quantidade: 29 } });
    const user = userEvent.setup();
    // qualquer papel importa quando a empresa já está configurada (F5)
    montar({ papel: "analista", temArquivoBanco: true });

    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    expect(screen.getByLabelText("Mês")).toHaveValue("10");
    expect(screen.getByLabelText("Ano")).toHaveValue("2026");
    expect(screen.getByText(/Período: 01\/10\/2026 a 31\/10\/2026/)).toBeInTheDocument();
    // aviso da decisão F2 quando já escolheu o banco
    expect(screen.getByText(/escolher o extrato do banco de novo/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    expect(importarDoSistema).toHaveBeenCalledWith("2026-10-01", "2026-10-31");
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(`/e/${EMPRESA.id}/conciliacoes/nova/ia/${importacaoId}`),
    );
  });

  it("datas inválidas no período manual não chamam o backend", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Escolher período menor" }));
    const inicio = screen.getByLabelText("Data inicial");
    const fim = screen.getByLabelText("Data final");
    await user.clear(inicio);
    await user.type(inicio, "2026-10-20");
    await user.clear(fim);
    await user.type(fim, "2026-10-10");
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    expect(importarDoSistema).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/período válido/i);
  });

  it("fica desligado com texto de progresso durante a busca e bloqueia segundo clique", async () => {
    let resolver!: (valor: unknown) => void;
    importarDoSistema.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));

    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));

    const botao = screen.getByRole("button", { name: "Buscar no sistema" });
    await user.click(botao);
    expect(screen.getByRole("button", { name: "Buscando no sistema…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Buscando no sistema…" }));
    expect(importarDoSistema).toHaveBeenCalledTimes(1);

    resolver({ ok: false, status: 422, codigo: "sistema_sem_lancamentos", erro: "Sem lançamentos.", erros: [], totalErros: 0 });
    expect(await screen.findByRole("button", { name: "Buscar no sistema" })).toBeEnabled();
  });

  it("502 com sistema_recusou_a_chave não desloga e oferece Configurações ao gestor ou aviso ao analista; 401 sem codigo desloga", async () => {
    const user = userEvent.setup();
    importarDoSistema.mockResolvedValueOnce({
      ok: false,
      status: 502,
      codigo: "sistema_recusou_a_chave",
      erro: "O sistema recusou a chave. Confira a chave da integração em Configurações.",
      erros: [],
      totalErros: 0,
    });

    const { unmount } = montar({ papel: "admin" });
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Chave recusada");
    expect(alerta).toHaveTextContent("O sistema recusou a chave.");
    expect(alerta).toHaveTextContent("Ou envie o arquivo CSV manualmente na folha acima.");
    expect(screen.getByRole("button", { name: "Abrir Configurações › Integração" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    unmount();

    // analista vê aviso sem botão de Configurações
    importarDoSistema.mockResolvedValueOnce({
      ok: false,
      status: 502,
      codigo: "sistema_recusou_a_chave",
      erro: "O sistema recusou a chave. Confira a chave da integração em Configurações.",
      erros: [],
      totalErros: 0,
    });
    const { unmount: unmountAnalista } = montar({ papel: "analista" });
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));
    expect(await screen.findByText(/Avise quem administra o Ledgr/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Configurações/ })).not.toBeInTheDocument();
    unmountAnalista();

    // 401 sem codigo ainda é sessão expirada
    importarDoSistema.mockResolvedValueOnce({
      ok: false,
      status: 401,
      erro: "Sua sessão expirou. Entre de novo para continuar.",
      erros: [],
      totalErros: 0,
    });
    montar({ papel: "admin" });
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it.each([
    [502, "sistema_nao_respondeu", "O sistema não respondeu. Tente de novo ou envie o arquivo.", true],
    [502, "sistema_indisponivel", "O sistema está com problemas agora. Tente de novo ou envie o arquivo.", true],
    [502, "sistema_redirecionou", "O endereço do sistema redirecionou. Confira a URL da integração.", true],
    [502, "sistema_endereco_nao_permitido", "O endereço do sistema não é permitido. Confira a configuração da integração.", true],
    [422, "sistema_sem_lancamentos", "O sistema não tem lançamentos nesse período.", false],
    [409, "integracao_nao_configurada", "Esta empresa ainda não configurou a integração com o sistema.", false],
    [503, "integracao_indisponivel", "Integração com o sistema indisponível no momento.", false],
  ])("trata %i / %s com detail do backend e caminho manual", async (status, codigo, detalhe, temTentarDeNovo) => {
    const user = userEvent.setup();
    importarDoSistema.mockResolvedValueOnce({ ok: false, status, codigo, erro: detalhe, erros: [], totalErros: 0 });
    montar();

    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(detalhe);
    expect(alerta).toHaveTextContent("Ou envie o arquivo CSV manualmente na folha acima.");
    if (temTentarDeNovo) {
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    }
  });

  it("sistema_resposta_grande_demais abre o período menor sincronizado com o mês buscado para a pessoa ajustar", async () => {
    const user = userEvent.setup();
    importarDoSistema.mockResolvedValueOnce({
      ok: false,
      status: 502,
      codigo: "sistema_resposta_grande_demais",
      erro: "O sistema devolveu um arquivo maior que 5 MB. Escolha um período menor.",
      erros: [],
      totalErros: 0,
    });
    montar();

    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    // altera manualmente para agosto, volta para mês inteiro (outubro) e dispara
    await user.click(screen.getByRole("button", { name: "Escolher período menor" }));
    await user.clear(screen.getByLabelText("Data inicial"));
    await user.type(screen.getByLabelText("Data inicial"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "Usar mês inteiro" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/maior que 5 MB/);
    expect(screen.getByLabelText("Data inicial")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Data final")).toHaveValue("2026-10-31");
    expect(screen.getByText("Ou envie o arquivo CSV manualmente na folha acima.")).toBeInTheDocument();
  });

  it("sistema_resposta_invalida mostra JSON inválido sem mencionar IA, com e sem lista de erros", async () => {
    const user = userEvent.setup();
    importarDoSistema
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        codigo: "sistema_resposta_invalida",
        erro: "O arquivo veio cortado.",
        erros: [],
        totalErros: 0,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        codigo: "sistema_resposta_invalida",
        erro: "O arquivo não passou na conferência",
        erros: [{ lancamento: 2, caminho: "lancamentos[1].valor", mensagem: "Valor inválido." }],
        totalErros: 1,
      });

    montar();
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("JSON inválido");
    expect(screen.getByRole("alert")).toHaveTextContent("O arquivo veio cortado.");
    expect(screen.getByText("Ou envie o arquivo CSV manualmente na folha acima.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
    expect(screen.getByText("lancamentos[1].valor")).toBeInTheDocument();
    expect(screen.queryByText(/peça à IA/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ou envie o arquivo CSV manualmente na folha acima.")).toBeInTheDocument();
  });

  it("429 e falha de rede mostram o aviso certo sem travar a tela", async () => {
    const user = userEvent.setup();
    importarDoSistema
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        erro: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
        erros: [],
        totalErros: 0,
      })
      .mockRejectedValueOnce(new TypeError("fetch failed"));

    montar();
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Muitas tentativas/);
    expect(screen.getByText("Ou envie o arquivo CSV manualmente na folha acima.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(SEM_SERVIDOR);
  });

  it("não redireciona se o componente desmontar enquanto a busca ainda está em andamento", async () => {
    let resolver!: (valor: unknown) => void;
    importarDoSistema.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));

    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(screen.getByRole("button", { name: "Importar de um sistema" }));
    await user.click(screen.getByRole("button", { name: "Buscar no sistema" }));

    unmount();
    resolver({ ok: true, dados: { importacaoId: "ea0a9f44-d4d2-4d65-93bf-8494eb235a94", quantidade: 5 } });
    await Promise.resolve();
    expect(assign).not.toHaveBeenCalled();
  });
});
