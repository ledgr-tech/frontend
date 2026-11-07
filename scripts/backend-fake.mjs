// ponytail: backend de mentira pro dev local, enquanto o FastAPI nao esta de pe.
// Node puro, sem dependencia, estado em memoria — some quando o processo morre.
// Le o conteudo de verdade dos OFX/CSV enviados e concilia com as regras do
// backend (app/services/matching.py: exato, tolerancia em dias, classificacao
// do que sobra). Sem a similaridade de descricao no desempate: num grupo de
// mesmo valor+data, pareia na ordem do arquivo. No boot, carrega os pares de
// `exemplos-extratos/`. Quando o backend real rodar local, e so apontar
// LEDGR_API_URL pra ele e esquecer este arquivo.
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PORTA = Number(process.env.PORT ?? 8000);
// as flags do backend de verdade, ligadas por padrão; =0 deixa como em produção (as capturas da Central)
const APROVACAO = process.env.APROVACAO_JUSTIFICATIVAS_HABILITADA !== "0";
const MCP = process.env.MCP_HABILITADO !== "0";
const PASTA_EXEMPLOS = join(import.meta.dirname, "..", "exemplos-extratos");
const TOLERANCIA_MAXIMA = 5;

const agora = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
const SENHA_PADRAO = "ledgr2026";

// Conta (o escritorio, ADR-019) -> empresas clientes -> os dados de cada uma. Os ids sao fixos para a
// sessao e as URLs `/e/<empresa>` sobreviverem a um restart do fake.
/** id -> { id, nome, situacao, plano, teste_termina_em, empresas: [id], convites: [], chaves: [], conexoes: [] } */
const contas = new Map();
/** id -> empresa + a base dela: extratos, execucoes, itens, fechamentos, configuracoes, decisoes */
const empresas = new Map();
/** email -> { id, conta_id, nome, email, senha, papel, criado_em, preferencias } */
const usuarios = new Map();

function novaConta(id, nome, situacao, plano, teste_termina_em = null) {
  const conta = { id, nome, situacao, plano, teste_termina_em, empresas: [], convites: [], chaves: [], conexoes: [] };
  contas.set(id, conta);
  return conta;
}

function novaEmpresa(conta, id, razao_social, cnpj) {
  const empresa = {
    id, conta_id: conta.id, razao_social, cnpj, cnpj_verificado_em: null, criado_em: agora(),
    /** id -> { origem, nome, formato, lancamentos, erros, periodoInicio, periodoFim, enviadoEm } */
    extratos: new Map(),
    /** da mais recente para a mais antiga */
    execucoes: [],
    /** `${banco}|${sistema}` -> itens da conciliacao */
    itens: new Map(),
    /** competencia -> registros de fechamento, do mais antigo pro mais recente */
    fechamentos: new Map(),
    configuracoes: { tolerancia_dias: 2, atualizado_por: null, atualizado_em: null },
    /** `${banco}|${chave}` -> { decisao, eventos } */
    decisoes: new Map(),
  };
  empresas.set(id, empresa);
  conta.empresas.push(id);
  return empresa;
}

function novoUsuario(conta, id, nome, email, papel, senha = SENHA_PADRAO) {
  const usuario = { id, conta_id: conta.id, nome, email, senha, papel, criado_em: agora(), preferencias: null };
  usuarios.set(email, usuario);
  return usuario;
}

// ---------- leitura dos arquivos (app/parsers/ofx.py e csv.py) ----------

const CREDITO_OFX = new Set(["CREDIT", "DEP", "DIRECTDEP", "INT", "DIV", "REPEATPMT"]);

function lerOfx(texto) {
  const lancamentos = [];
  for (const [, bloco] of texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const campo = (nome) => bloco.match(new RegExp(`<${nome}>([^\\r\\n<]*)`, "i"))?.[1]?.trim();
    const d = campo("DTPOSTED") ?? "";
    const valor = Number(campo("TRNAMT"));
    const tipo = (campo("TRNTYPE") ?? "").toUpperCase();
    lancamentos.push({
      id: randomUUID(),
      data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      valor: valor.toFixed(2),
      descricao: campo("MEMO") ?? campo("NAME") ?? "",
      tipo: CREDITO_OFX.has(tipo) || (tipo === "OTHER" && valor >= 0) ? "credito" : "debito",
    });
  }
  return { lancamentos, erros: [] };
}

function dataCsv(bruto) {
  const t = bruto.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!br) return null;
  const iso = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso) ? iso : null;
}

function lerCsv(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) throw new Error("Arquivo CSV vazio.");
  const sep = [";", ",", "\t", "|"].sort((a, b) => linhas[0].split(b).length - linhas[0].split(a).length)[0];
  const cab = linhas[0].split(sep).map((c) => c.trim().toLowerCase());
  const falta = ["data", "descricao", "valor"].filter((c) => !cab.includes(c));
  if (falta.length) throw new Error(`CSV não tem as colunas obrigatórias ${JSON.stringify(falta)}.`);
  const lancamentos = [];
  const erros = [];
  linhas.slice(1).forEach((linha, i) => {
    const col = Object.fromEntries(linha.split(sep).map((v, j) => [cab[j], v.trim()]));
    if (!/^-?\d+(\.\d+)?$/.test(col.valor ?? "")) {
      return erros.push({ identificador: String(i + 2), motivo: `Valor inválido no CSV: '${col.valor}'` });
    }
    const data = dataCsv(col.data ?? "");
    if (!data) return erros.push({ identificador: String(i + 2), motivo: `Data inválida no CSV: '${col.data}'` });
    const valor = Number(col.valor);
    lancamentos.push({ id: randomUUID(), data, valor: valor.toFixed(2), descricao: col.descricao, tipo: valor >= 0 ? "credito" : "debito" });
  });
  return { lancamentos, erros };
}

const normalizar = (descricao) => descricao.trim().toLowerCase().replace(/\s+/g, " ");

/** A chave de uma linha so do sistema, a mesma em todas as versoes do arquivo (services/decisoes.py). */
const chaveDoSistema = (l) =>
  createHash("sha256").update(`${l.valor}|${l.data}|${normalizar(l.descricao)}|${l.ocorrencia}`).digest("hex");

/** `fator` multiplica os valores: a mesma pasta de exemplos vira o movimento de outra empresa. */
function registrarExtrato(b, nome, origem, bytes, enviadoEm = agora(), fator = 1) {
  const utf8 = bytes.toString("utf8");
  const texto = utf8.includes("�") ? bytes.toString("latin1") : utf8;
  const formato = nome.toLowerCase().endsWith(".ofx") ? "ofx" : "csv";
  const { lancamentos, erros } = formato === "ofx" ? lerOfx(texto) : lerCsv(texto);
  if (fator !== 1) for (const l of lancamentos) l.valor = (Number(l.valor) * fator).toFixed(2);
  // linhas identicas no mesmo arquivo: 1, 2, 3... na ordem em que aparecem
  const vistas = new Map();
  for (const l of lancamentos) {
    const k = `${l.valor}|${l.data}|${normalizar(l.descricao)}`;
    vistas.set(k, (vistas.get(k) ?? 0) + 1);
    Object.defineProperty(l, "ocorrencia", { value: vistas.get(k) }); // fora do JSON da resposta
  }
  const datas = lancamentos.map((l) => l.data).sort();
  const id = randomUUID();
  b.extratos.set(id, { origem, nome, formato, lancamentos, erros, periodoInicio: datas[0] ?? null, periodoFim: datas.at(-1) ?? null, enviadoEm });
  return id;
}

// ---------- conciliacao (app/services/matching.py) ----------

const TERMOS_TARIFA = ["tarifa", "tar pacote", "manutencao de conta", "manutenção de conta", "cesta de servicos",
  "cesta de serviços", "anuidade", "iof", "pacote de servicos", "pacote de serviços", "taxa de manutencao", "taxa de manutenção"];
const dias = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

function conciliar(banco, sistema, tolerancia) {
  const linhas = [];
  const par = (status, b, s, regra = null, score = null, grupo = null) => linhas.push({ status, b, s, regra, score, grupo });

  // 1) exato: mesmo valor + data; excedente de um grupo com par e duplicado
  const grupos = new Map();
  for (const [lado, lista] of [["b", banco], ["s", sistema]]) {
    for (const l of lista) {
      const chave = `${l.data}|${l.valor}`;
      if (!grupos.has(chave)) grupos.set(chave, { b: [], s: [] });
      grupos.get(chave)[lado].push(l);
    }
  }
  let soltosB = [];
  let soltosS = [];
  for (const chave of [...grupos.keys()].sort()) {
    const { b, s } = grupos.get(chave);
    const n = Math.min(b.length, s.length);
    for (let i = 0; i < n; i++) par("match_exato", b[i], s[i], "exato", "1.000");
    if (n) {
      b.slice(n).forEach((l) => par("duplicado", l, null));
      s.slice(n).forEach((l) => par("duplicado", null, l));
    } else {
      soltosB.push(...b);
      soltosS.push(...s);
    }
  }

  // 2) tolerancia: mesmo valor, ate `tolerancia` dias, o mais perto primeiro
  if (tolerancia > 0) {
    const candidatos = soltosB
      .flatMap((b) => soltosS.filter((s) => s.valor === b.valor && dias(b.data, s.data) <= tolerancia).map((s) => [dias(b.data, s.data), b, s]))
      .sort((x, y) => x[0] - y[0] || x[1].data.localeCompare(y[1].data));
    const usados = new Set();
    for (const [d, b, s] of candidatos) {
      if (usados.has(b.id) || usados.has(s.id)) continue;
      usados.add(b.id).add(s.id);
      par("match_tolerancia", b, s, "tolerancia", (1 - d / (tolerancia + 1)).toFixed(3));
    }
    soltosB = soltosB.filter((l) => !usados.has(l.id));
    soltosS = soltosS.filter((l) => !usados.has(l.id));
  }

  // 2b) soma (#131): 1 lancamento de um lado = 2 ou 3 do outro, mesmo sinal, ate `tolerancia` dias; o fake olha so
  // pares e trios (ponytail: o backend real procura subconjuntos maiores)
  const combos = (lista) => [...lista.flatMap((a, i) => lista.slice(i + 1).map((b) => [a, b])),
    ...lista.flatMap((a, i) => lista.slice(i + 1).flatMap((b, j) => lista.slice(i + j + 2).map((c) => [a, b, c])))];
  const cents = (l) => Math.round(Number(l.valor) * 100);
  for (const [unicos, outros, unicoEhBanco] of [[soltosB, soltosS, true], [soltosS, soltosB, false]]) {
    for (const u of [...unicos]) {
      const achado = combos(outros).find((c) => c.reduce((t, l) => t + cents(l), 0) === cents(u)
        && c.every((l) => cents(l) * cents(u) > 0 && dias(l.data, u.data) <= tolerancia));
      if (!achado) continue;
      const g = randomUUID();
      const desvio = Math.max(...achado.map((l) => dias(l.data, u.data)));
      const grupo = { quantidade_banco: unicoEhBanco ? 1 : achado.length, quantidade_sistema: unicoEhBanco ? achado.length : 1,
        valor_unico: u.valor, maior_desvio_dias: desvio };
      linhas.push({ status: "match_agrupado", b: unicoEhBanco ? u : null, s: unicoEhBanco ? null : u, regra: "soma", score: "1.000", grupo, grupoId: g });
      for (const m of achado) linhas.push({ status: "match_agrupado", b: unicoEhBanco ? null : m, s: unicoEhBanco ? m : null, regra: "soma", score: "1.000", grupo, grupoId: g });
      for (const l of [u, ...achado]) { const k = (unicoEhBanco ? soltosB : soltosS).indexOf(l); if (k >= 0) (unicoEhBanco ? soltosB : soltosS).splice(k, 1); else (unicoEhBanco ? soltosS : soltosB).splice((unicoEhBanco ? soltosS : soltosB).indexOf(l), 1); }
    }
  }

  // 3) o que sobrou: tarifa (so banco) > divergente_valor > divergente_data > sem_correspondencia
  const classifica = (l, outros, banco) => {
    const desc = l.descricao.trim().toLowerCase();
    if (banco && TERMOS_TARIFA.some((t) => desc.includes(t))) return "tarifa_bancaria";
    if (outros.some((o) => o.data === l.data)) return "divergente_valor";
    if (outros.some((o) => o.valor === l.valor)) return "divergente_data";
    return "sem_correspondencia";
  };
  soltosB.forEach((l) => par(classifica(l, soltosS, true), l, null));
  soltosS.forEach((l) => par(classifica(l, soltosB, false), null, l));
  return linhas;
}

const CATEGORIAS = ["match_exato", "match_tolerancia", "match_agrupado", "duplicado", "sem_correspondencia", "tarifa_bancaria", "divergente_valor", "divergente_data"];

function contar(lista) {
  const zero = Object.fromEntries([["total", lista.length], ...CATEGORIAS.map((c) => [c, 0])]);
  return lista.reduce((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), zero);
}

function executar(b, bancoId, sistemaId, executadaEm = agora()) {
  const { extratos, execucoes, itens, configuracoes } = b;
  const banco = extratos.get(bancoId);
  const sistema = extratos.get(sistemaId);
  if (!banco || !sistema) return null;

  const lista = conciliar(banco.lancamentos, sistema.lancamentos, configuracoes.tolerancia_dias).map((l) => ({
    id: randomUUID(),
    extrato_sistema_id: sistemaId,
    status: l.status,
    regra_aplicada: l.regra,
    score_confianca: l.score,
    lancamento_banco: l.b,
    lancamento_sistema: l.s,
    chave: l.b?.id ?? chaveDoSistema(l.s),
    ...(l.grupo ? { grupo_id: l.grupoId, grupo: l.grupo } : {}),
  }));
  itens.set(`${bancoId}|${sistemaId}`, lista);
  const contagens = contar(lista);
  // refazer o mesmo par tira o "atual" da rodada anterior
  for (const antiga of execucoes) {
    if (antiga.extrato_banco_id === bancoId && antiga.extrato_sistema_id === sistemaId) antiga.atual = false;
  }
  const acerto = contagens.total ? ((contagens.match_exato + contagens.match_tolerancia) * 100) / contagens.total : null;
  execucoes.unshift({
    id: randomUUID(),
    extrato_banco_id: bancoId,
    extrato_sistema_id: sistemaId,
    nome_arquivo_banco: banco.nome,
    nome_arquivo_sistema: sistema.nome,
    executada_em: executadaEm,
    tolerancia_dias: configuracoes.tolerancia_dias,
    contagens: { ...contagens, justificadas: 0 },
    percentual_acerto: acerto === null ? null : acerto.toFixed(2),
    atual: true,
    periodo_inicio: banco.periodoInicio,
    periodo_fim: banco.periodoFim,
  });
  return contagens;
}

// ---------- fechamento do mes ----------

const competenciaDe = (e) => (e.periodo_inicio ?? e.executada_em).slice(0, 7);
const fechamentoAtivo = (b, competencia) => {
  const ultimo = b.fechamentos.get(competencia)?.at(-1);
  return ultimo && !ultimo.reaberto_em ? ultimo : null;
};
const respostaFechamento = (f) => ({ ...f, estado: f.reaberto_em ? "reaberto" : "fechado" });

/** Justificadas que valem e as que esperam aprovacao, entre as linhas que nao bateram. */
function contarDecisoes(b, bancoId, lista = []) {
  let justificadas = 0;
  let aguardando = 0;
  for (const item of lista) {
    if (item.status.startsWith("match_")) continue;
    const d = b.decisoes.get(`${bancoId}|${item.chave}`)?.decisao;
    if (d?.tipo !== "justificada") continue;
    if (d.situacao === "pendente") aguardando++;
    else justificadas++;
  }
  return { justificadas, aguardando_aprovacao: aguardando };
}

const comDecisoes = (b, e) => ({
  ...e,
  contagens: { ...e.contagens, ...contarDecisoes(b, e.extrato_banco_id, b.itens.get(`${e.extrato_banco_id}|${e.extrato_sistema_id}`)) },
});

function resumoDoMes(b, competencia) {
  const { execucoes, extratos } = b;
  // a rodada que conta e a mais recente de cada extrato do banco (`execucoes` ja vem da mais recente)
  const atuais = execucoes.filter(
    (e, i) => competenciaDe(e) === competencia && execucoes.findIndex((x) => x.extrato_banco_id === e.extrato_banco_id) === i,
  ).map((e) => comDecisoes(b, e));
  const contagens = Object.fromEntries([["total", 0], ...CATEGORIAS.map((c) => [c, 0])]);
  for (const e of atuais) for (const c of Object.keys(contagens)) contagens[c] += e.contagens[c];
  const justificadas = atuais.reduce((n, e) => n + e.contagens.justificadas, 0);
  const aguardando = atuais.reduce((n, e) => n + e.contagens.aguardando_aprovacao, 0);
  const pendentes = contagens.total - contagens.match_exato - contagens.match_tolerancia - justificadas;
  const linhasNaoLidas = atuais.reduce(
    (n, e) => n + extratos.get(e.extrato_banco_id).erros.length + extratos.get(e.extrato_sistema_id).erros.length, 0);
  return {
    pares: atuais.map((e) => ({
      extrato_banco_id: e.extrato_banco_id,
      extrato_sistema_id: e.extrato_sistema_id,
      execucao_id: e.id,
      rodada: execucoes.filter((x) => x.extrato_banco_id === e.extrato_banco_id && x.executada_em <= e.executada_em).length,
      nome_arquivo_banco: e.nome_arquivo_banco,
      nome_arquivo_sistema: e.nome_arquivo_sistema,
    })),
    contagens,
    justificadas,
    aguardando_aprovacao: aguardando,
    pendentes,
    linhas_nao_lidas: linhasNaoLidas,
    valor_em_aberto: "0.00",
  };
}

// ---------- http ----------

function csv(lista) {
  const linhas = lista.map((item) => {
    const ref = item.lancamento_banco ?? item.lancamento_sistema;
    return [ref.data, `"${ref.descricao}"`, item.lancamento_banco?.valor ?? "", item.lancamento_sistema?.valor ?? "", item.status].join(";");
  });
  // BOM: sem ele o Excel em portugues abre os acentos quebrados
  return "﻿" + ["data;descricao;valor_banco;valor_sistema;status", ...linhas].join("\r\n");
}

function json(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

async function corpoBruto(req) {
  const partes = [];
  for await (const pedaco of req) partes.push(pedaco);
  return Buffer.concat(partes);
}

const corpoJson = async (req) => JSON.parse((await corpoBruto(req)).toString("utf8") || "{}");

/** As partes de um multipart/form-data: nome -> { filename?, bytes } */
function multipart(req, bruto) {
  const fronteira = req.headers["content-type"]?.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const texto = bruto.toString("latin1");
  const partes = {};
  for (const parte of texto.split(`--${fronteira?.[1] ?? fronteira?.[2]}`)) {
    const fim = parte.indexOf("\r\n\r\n");
    if (fim < 0) continue;
    const cabecalho = parte.slice(0, fim);
    const nome = cabecalho.match(/name="([^"]*)"/)?.[1];
    if (!nome) continue;
    partes[nome] = {
      filename: cabecalho.match(/filename="([^"]*)"/)?.[1],
      bytes: Buffer.from(parte.slice(fim + 4).replace(/\r\n$/, ""), "latin1"),
    };
  }
  return partes;
}

// ---------- tokens de link (os "e-mails" saem no console do fake) ----------

const FRONT = process.env.LEDGR_FRONT_URL ?? "http://localhost:3000";
/** token -> { emailAntigo, emailNovo } */
const trocasDeEmail = new Map();
/** token -> email */
const recuperacoes = new Map();
/** token -> { conta_id, convite_id } */
const tokensDeConvite = new Map();
/** id -> pedido de conexao MCP: { cliente, host, loopback, redirect, state, expira_em } */
const pedidosMcp = new Map();
const importacoesIa = new Map();

const link = (rotulo, url) => console.log(`[${rotulo}] ${url}`);
const emDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function novoPedidoMcp(cliente = "ChatGPT", redirect = "http://127.0.0.1:6274/oauth/callback") {
  const id = randomUUID();
  const host = new URL(redirect).host;
  pedidosMcp.set(id, { cliente, host, loopback: /^(127\.0\.0\.1|localhost|\[::1\])(:|$)/.test(host), redirect,
    state: randomUUID().slice(0, 8), expira_em: new Date(Date.now() + 86_400_000).toISOString() }); // no backend sao 10 min; aqui um dia, para testar com calma
  link("pedido de conexao MCP", `${FRONT}/autorizar-conexao?pedido=${id}`);
  return id;
}

function usuarioDoToken(req) {
  try {
    const carga = JSON.parse(Buffer.from(req.headers.authorization.slice(7).split(".")[1], "base64url").toString("utf8"));
    return usuarios.get(carga.email) ?? null;
  } catch {
    return null;
  }
}

/** O corpo do `/login`: o `empresa_id` legado e o `conta_id` (backend #142). */
function respostaDeLogin(u) {
  return { id: u.id, conta_id: u.conta_id, empresa_id: contas.get(u.conta_id).empresas[0], nome: u.nome, email: u.email,
    auth_time: Math.floor(Date.now() / 1000) };
}

const pessoa = ({ id, nome, email, papel, criado_em }) => ({ id, nome, email, papel, criado_em });
const empresaCliente = ({ id, razao_social, cnpj, cnpj_verificado_em, criado_em }) => ({ id, razao_social, cnpj, cnpj_verificado_em, criado_em });
const pessoasDaConta = (contaId) => [...usuarios.values()].filter((u) => u.conta_id === contaId);
const MAXIMOS = { essencial: { empresas: 1, usuarios: 2 }, padrao: { empresas: 5, usuarios: 5 }, avancado: { empresas: null, usuarios: null } };

function chaveApi(conta, c) {
  const empresa = c.empresa_id && empresas.get(c.empresa_id);
  return { id: c.id, nome: c.nome, prefixo: c.prefixo,
    escopo: empresa ? { tipo: "empresa", empresa_id: empresa.id, razao_social: empresa.razao_social } : { tipo: "conta" },
    criada_por: c.criada_por, criado_em: c.criado_em, ultimo_uso_em: c.ultimo_uso_em, revogada_em: c.revogada_em };
}

const conexao = (c) => ({ ...c, empresa: { id: c.empresa_id, razao_social: empresas.get(c.empresa_id)?.razao_social ?? "" }, empresa_id: undefined });

// ---------- decisoes por linha (backend #83 e #132, com a aprovacao ligada) ----------

/** As linhas da rodada atual de um extrato do banco (a mais recente de cada par). */
function linhasDoBanco(b, bancoId) {
  return [...b.itens.entries()].filter(([k]) => k.startsWith(`${bancoId}|`)).flatMap(([, lista]) => lista);
}

const rodadaDe = (b, bancoId) => b.execucoes.filter((e) => e.extrato_banco_id === bancoId).length;

/** Aplica uma decisao; devolve { status, corpo }. */
function decidir(b, eu, bancoId, chave, tipo, texto, em = agora()) {
  const banco = b.extratos.get(bancoId);
  if (!banco) return { status: 404, corpo: { detail: "Conciliação não encontrada." } };
  if (!linhasDoBanco(b, bancoId).some((i) => i.chave === chave)) return { status: 404, corpo: { detail: "Linha não encontrada." } };
  if (banco.periodoInicio && fechamentoAtivo(b, banco.periodoInicio.slice(0, 7))) {
    return { status: 409, corpo: { detail: "Este mês está fechado. Reabra o mês para mudar as decisões." } };
  }
  const gestao = eu.papel !== "analista";
  const k = `${bancoId}|${chave}`;
  const registro = b.decisoes.get(k) ?? { decisao: null, eventos: [] };
  const rodada = rodadaDe(b, bancoId);
  const atual = registro.decisao;
  const texto_ = typeof texto === "string" && texto.trim() ? texto.trim() : null;

  if (tipo === "justificativa_aprovada" || tipo === "justificativa_rejeitada") {
    if (!gestao) return { status: 403, corpo: { detail: "Só o admin ou o gestor aprovam justificativas." } };
    if (atual?.tipo !== "justificada" || atual.situacao !== "pendente") {
      return { status: 409, corpo: { detail: "Esta justificativa não está aguardando aprovação." } };
    }
    registro.decisao = tipo === "justificativa_aprovada" ? { ...atual, situacao: "aprovada", aprovada_por: eu.nome, aprovada_em: em } : null;
  } else if (tipo === "conferida") {
    registro.decisao = { tipo, texto: null, autor: eu.nome, em, rodada };
  } else if (tipo === "justificada") {
    if (!texto_) return { status: 422, corpo: { detail: "Escreva a justificativa." } };
    // sem a aprovação (produção), a justificativa nasce valendo, sem situação: como antes do backend #132
    registro.decisao = !APROVACAO
      ? { tipo, texto: texto_, autor: eu.nome, em, rodada }
      : gestao
      ? { tipo, texto: texto_, autor: eu.nome, em, rodada, situacao: "aprovada", aprovada_por: eu.nome, aprovada_em: em }
      : { tipo, texto: texto_, autor: eu.nome, em, rodada, situacao: "pendente" };
  } else if (tipo === "conferencia_desfeita" || tipo === "justificativa_desfeita") {
    registro.decisao = null;
  } else {
    return { status: 422, corpo: { detail: "Tipo de decisão desconhecido." } };
  }
  registro.eventos.push({ tipo, texto: texto_, autor: eu.nome, em, rodada });
  b.decisoes.set(k, registro);
  return { status: 200, corpo: registro.decisao };
}

function fechar(b, competencia, ressalva, autor, em = agora()) {
  const registro = { id: randomUUID(), competencia, ressalva, fechado_por: autor, fechado_em: em,
    reaberto_por: null, reaberto_em: null, resumo: resumoDoMes(b, competencia) };
  b.fechamentos.set(competencia, [...(b.fechamentos.get(competencia) ?? []), registro]);
  return registro;
}

// ---------- assistente: busca por palavras no texto da Central, sem IA ----------

let ajuda = null;
const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function responderPergunta(pergunta) {
  ajuda ??= await fetch(`${FRONT}/ajuda/conteudo.json`).then((r) => r.json()).catch(() => null);
  if (!ajuda) return null;
  const palavras = semAcento(pergunta).split(/[^a-z0-9]+/).filter((p) => p.length > 3);
  const candidatas = ajuda.paginas.flatMap((pagina) => pagina.funcoes.map((funcao) => {
    const texto = semAcento([funcao.titulo, funcao.faz, ...(funcao.passos ?? [])].join(" "));
    return { pagina, funcao, pontos: palavras.filter((p) => texto.includes(p)).length };
  })).filter((c) => c.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 2);
  if (!candidatas.length) {
    return { resposta: "(backend fake) Não achei isso na Central de ajuda.", respondida: false, links: [] };
  }
  const [{ funcao }] = candidatas;
  const passos = funcao.passos?.map((p, i) => `${i + 1}. ${p.replace(/\*\*/g, "")}`).join("\n");
  return {
    resposta: `(backend fake) ${funcao.faz.replace(/\*\*/g, "")}${passos ? `\n${passos}` : ""}`,
    respondida: true,
    links: candidatas.map(({ pagina, funcao: f }) => ({ titulo: `${pagina.titulo} › ${f.titulo}`, caminho: `/ajuda/${pagina.id}#${f.id}` })),
  };
}

// ---------- http ----------

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const caminho = url.pathname;
  const q = url.searchParams;
  const limit = Number(q.get("limit") ?? 20);
  const offset = Number(q.get("offset") ?? 0);
  const pagina = (lista, extra = {}) => ({ total: lista.length, limit, offset, ...extra, itens: lista.slice(offset, offset + limit) });
  const metodo = req.method;
  const rota = (m, r) => metodo === m && (typeof r === "string" ? caminho === r : caminho.match(r));

  // ----- publicas: onde a sessao nasce, links de e-mail e o atalho de dev -----

  if (rota("POST", "/login")) {
    const corpo = await corpoJson(req);
    const u = usuarios.get(String(corpo.email ?? "").trim().toLowerCase());
    if (!u || u.senha !== corpo.senha) return json(res, 401, { detail: "E-mail ou senha inválidos." });
    return json(res, 200, respostaDeLogin(u));
  }

  if (rota("POST", "/register/verificar")) {
    const corpo = await corpoJson(req);
    const cnpj = String(corpo.cnpj ?? "").replace(/[.\-/\s]/g, "").toUpperCase();
    return json(res, 200, {
      email_disponivel: !usuarios.has(String(corpo.email ?? "").trim().toLowerCase()),
      cnpj_disponivel: ![...empresas.values()].some((e) => e.cnpj === cnpj),
      cnpj_situacao: "nao_verificado",
    });
  }

  if (rota("POST", "/register")) {
    const corpo = await corpoJson(req);
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const cnpj = String(corpo.cnpj ?? "").replace(/[.\-/\s]/g, "").toUpperCase();
    if (usuarios.has(email)) return json(res, 409, { detail: "E-mail já cadastrado." });
    if ([...empresas.values()].some((e) => e.cnpj === cnpj)) return json(res, 409, { detail: "CNPJ já cadastrado." });
    // como o backend: a conta nasce sem plano e o app manda escolher um em /plano
    const conta = novaConta(randomUUID(), corpo.razao_social ?? corpo.nome, "sem_plano", null);
    novaEmpresa(conta, randomUUID(), corpo.razao_social ?? corpo.nome, cnpj);
    const u = novoUsuario(conta, randomUUID(), corpo.nome, email, "admin", corpo.senha);
    return json(res, 201, respostaDeLogin(u));
  }

  if (rota("POST", "/senha/recuperar")) {
    const { email } = await corpoJson(req);
    const alvo = String(email ?? "").trim().toLowerCase();
    if (usuarios.has(alvo)) {
      const token = randomUUID();
      recuperacoes.set(token, alvo);
      link("recuperar senha", `${FRONT}/redefinir-senha#token=${token}`);
    }
    return json(res, 202, { detail: "Se o e-mail tiver conta, o link foi enviado." });
  }

  if (rota("POST", "/senha/redefinir")) {
    const { token, senha_nova } = await corpoJson(req);
    const email = recuperacoes.get(token);
    recuperacoes.delete(token);
    if (!email || !usuarios.has(email)) return json(res, 400, { detail: "Link inválido ou expirado." });
    usuarios.get(email).senha = senha_nova;
    res.writeHead(204);
    return res.end();
  }

  if (rota("POST", "/convites/consultar") || rota("POST", "/convites/aceitar")) {
    const corpo = await corpoJson(req);
    const ref = tokensDeConvite.get(corpo.token);
    const conta = ref && contas.get(ref.conta_id);
    const convite = conta?.convites.find((c) => c.id === ref.convite_id);
    if (!convite) return json(res, 400, { detail: "Convite inválido, expirado ou já usado." });
    if (caminho === "/convites/consultar") {
      return json(res, 200, { email: convite.email, razao_social: empresas.get(conta.empresas[0]).razao_social, expira_em: convite.expira_em });
    }
    if (usuarios.has(convite.email)) return json(res, 409, { detail: "Este e-mail já tem conta." });
    const u = novoUsuario(conta, randomUUID(), String(corpo.nome ?? "").trim(), convite.email, convite.papel, corpo.senha);
    conta.convites = conta.convites.filter((c) => c !== convite);
    tokensDeConvite.delete(corpo.token);
    return json(res, 200, respostaDeLogin(u));
  }

  // POST /me/email/confirmar (#149) — publica: o link pode abrir noutro navegador
  if (rota("POST", "/me/email/confirmar")) {
    const { token } = await corpoJson(req);
    const pedido = trocasDeEmail.get(token);
    trocasDeEmail.delete(token);
    if (!pedido) return json(res, 400, { detail: "Link inválido ou expirado." });
    if (usuarios.has(pedido.emailNovo)) return json(res, 409, { detail: "E-mail já cadastrado." });
    const u = usuarios.get(pedido.emailAntigo);
    usuarios.delete(pedido.emailAntigo);
    usuarios.set(pedido.emailNovo, { ...u, email: pedido.emailNovo });
    return json(res, 200, { email: pedido.emailNovo });
  }

  // atalho so do fake: um pedido de conexao MCP novo, para testar /autorizar-conexao
  if (rota("GET", "/dev/pedido-mcp")) {
    const id = novoPedidoMcp(q.get("cliente") ?? "Claude", q.get("redirect") ?? undefined);
    return json(res, 200, { url: `${FRONT}/autorizar-conexao?pedido=${id}` });
  }

  // ----- daqui pra baixo, com Bearer -----

  if (!req.headers.authorization?.startsWith("Bearer ")) return json(res, 401, { detail: "Token ausente." });
  const eu = usuarioDoToken(req);
  if (!eu) return json(res, 401, { detail: "Usuário não encontrado. Entre de novo." });
  const conta = contas.get(eu.conta_id);
  const gestao = eu.papel !== "analista";
  const proibido = (detail = "Seu papel na conta não permite fazer isso.") => json(res, 403, { detail });
  const pedida = req.headers["x-ledgr-empresa"];
  if (pedida && !conta.empresas.includes(pedida)) return json(res, 403, { detail: "Esta empresa não é da sua conta." });
  // a conta inativa do backend #156, para todas as contas com CONTA_INATIVA=1: escrita dá 403 com o código,
  // menos as da própria pessoa, o checkout e as revogações (app/core/conta_inativa.py, LIBERADAS)
  const liberadas = [
    /^POST \/me\/(senha|email)$/,
    /^PATCH \/me\/preferencias$/,
    /^DELETE \/me$/,
    /^(PUT|DELETE) \/empresas\/[^/]+\/favorita$/,
    /^POST \/assinatura\/checkout$/,
    /^DELETE \/(chaves-api|conexoes-mcp|empresa\/usuarios)\/[^/]+$/,
    /^DELETE \/fechamentos\/[^/]+\/links\/[^/]+$/,
  ];
  if (process.env.CONTA_INATIVA === "1" && metodo !== "GET" && !liberadas.some((r) => r.test(`${metodo} ${caminho}`))) {
    return json(res, 403, {
      detail: "Esta conta está inativa. Você pode consultar e exportar os dados, mas não pode fazer alterações. Fale com o Ledgr para reativar.",
      codigo: "conta_inativa",
    });
  }
  const b = empresas.get(pedida ?? conta.empresas[0]);
  const semCorpo = () => (res.writeHead(204), res.end());

  // ----- a pessoa (/me) -----

  if (rota("GET", "/me")) {
    const plano = MAXIMOS[conta.plano] ?? MAXIMOS.padrao;
    return json(res, 200, {
      id: eu.id, conta_id: conta.id, empresa_id: b.id, nome: eu.nome, email: eu.email,
      razao_social: b.razao_social, cnpj: b.cnpj,
      metodos_login: ["senha"],
      papel: eu.papel,
      empresas: conta.empresas.map((id) => empresas.get(id)).map(({ id, razao_social, cnpj }) => ({ id, razao_social, cnpj })),
      preferencias: eu.preferencias,
      situacao: conta.situacao,
      plano: conta.plano,
      teste_termina_em: conta.teste_termina_em,
      limites: {
        empresas: { usadas: conta.empresas.length, maximo: plano.empresas },
        usuarios: { usados: pessoasDaConta(conta.id).length, maximo: plano.usuarios },
      },
    });
  }

  if (rota("PATCH", "/me/preferencias")) {
    eu.preferencias = { ...(eu.preferencias ?? {}), ...(await corpoJson(req)) };
    return json(res, 200, eu.preferencias);
  }

  if (rota("POST", "/me/senha")) {
    const { senha_atual, senha_nova } = await corpoJson(req);
    if (eu.senha !== senha_atual) return json(res, 400, { detail: "Senha atual incorreta." });
    if (String(senha_nova ?? "").length < 8) return json(res, 422, { detail: "A senha nova precisa de 8 caracteres ou mais." });
    eu.senha = senha_nova;
    return semCorpo();
  }

  if (rota("POST", "/me/email")) {
    const corpo = await corpoJson(req);
    const emailNovo = String(corpo.email_novo ?? "").trim().toLowerCase();
    if (eu.senha !== corpo.senha_atual) return json(res, 400, { detail: "Senha atual incorreta." });
    if (emailNovo === eu.email) return json(res, 422, { detail: "O e-mail novo é igual ao atual." });
    if (usuarios.has(emailNovo)) return json(res, 409, { detail: "E-mail já cadastrado." });
    const token = randomUUID();
    trocasDeEmail.set(token, { emailAntigo: eu.email, emailNovo });
    link("troca de e-mail", `${FRONT}/confirmar-email#token=${token}`);
    return json(res, 202, { email_novo: emailNovo, expira_em: new Date(Date.now() + 3600_000).toISOString() });
  }

  if (rota("DELETE", "/me")) {
    const { senha_atual } = await corpoJson(req);
    if (eu.senha !== senha_atual) return json(res, 400, { detail: "Senha atual incorreta." });
    if (eu.papel === "admin" && pessoasDaConta(conta.id).length > 1) {
      return json(res, 409, { detail: "Transfira o papel de admin para outra pessoa antes de desativar a sua conta." });
    }
    usuarios.delete(eu.email);
    return semCorpo();
  }

  if (rota("POST", "/empresa/plano")) {
    const { plano } = await corpoJson(req);
    if (!(plano in MAXIMOS)) return json(res, 422, { detail: "Plano desconhecido." });
    if (eu.papel !== "admin") return proibido("Só o admin escolhe o plano.");
    Object.assign(conta, { plano, situacao: conta.situacao === "sem_plano" ? "teste" : conta.situacao,
      teste_termina_em: conta.teste_termina_em ?? emDias(14) });
    return json(res, 200, { situacao: conta.situacao, plano, teste_termina_em: conta.teste_termina_em });
  }

  // ----- empresas da conta -----

  if (rota("GET", "/empresas")) return json(res, 200, { itens: conta.empresas.map((id) => empresaCliente(empresas.get(id))) });

  if (rota("POST", "/empresas")) {
    if (!gestao) return proibido();
    const { cnpj, razao_social } = await corpoJson(req);
    const limpo = String(cnpj ?? "").toUpperCase();
    if (conta.empresas.some((id) => empresas.get(id).cnpj === limpo)) return json(res, 409, { detail: "Esta empresa já está cadastrada." });
    const maximo = (MAXIMOS[conta.plano] ?? MAXIMOS.padrao).empresas;
    if (maximo !== null && conta.empresas.length >= maximo) return json(res, 402, { detail: `O plano permite ${maximo} empresas.` });
    return json(res, 201, empresaCliente(novaEmpresa(conta, randomUUID(), String(razao_social).trim(), limpo)));
  }

  // ----- equipe e convites -----

  if (rota("GET", "/empresa/usuarios")) return json(res, 200, { itens: pessoasDaConta(conta.id).map(pessoa) });

  const umaPessoa = rota("PATCH", /^\/empresa\/usuarios\/([^/]+)$/) || rota("DELETE", /^\/empresa\/usuarios\/([^/]+)$/);
  if (umaPessoa) {
    const alvo = pessoasDaConta(conta.id).find((u) => u.id === decodeURIComponent(umaPessoa[1]));
    if (!alvo) return json(res, 404, { detail: "Pessoa não encontrada." });
    if (alvo.papel === "admin") return json(res, 409, { detail: "Transfira o papel de admin antes." });
    if (metodo === "PATCH") {
      if (eu.papel !== "admin") return proibido("Só o admin muda papéis.");
      const { papel } = await corpoJson(req);
      if (papel !== "gestor" && papel !== "analista") return json(res, 422, { detail: "Papel inválido." });
      alvo.papel = papel;
      return json(res, 200, pessoa(alvo));
    }
    if (eu.papel !== "admin") return proibido("Só o admin remove pessoas.");
    usuarios.delete(alvo.email);
    return semCorpo();
  }

  if (rota("POST", "/empresa/admin/transferencia")) {
    if (eu.papel !== "admin") return proibido("Só o admin transfere o papel.");
    const { usuario_id, senha_atual } = await corpoJson(req);
    if (eu.senha !== senha_atual) return json(res, 400, { detail: "Senha atual incorreta." });
    const alvo = pessoasDaConta(conta.id).find((u) => u.id === usuario_id);
    if (!alvo || alvo === eu) return json(res, 404, { detail: "Pessoa não encontrada." });
    alvo.papel = "admin";
    eu.papel = "gestor";
    return json(res, 200, { itens: pessoasDaConta(conta.id).map(pessoa) });
  }

  if (rota("GET", "/empresa/convites")) {
    if (!gestao) return proibido();
    return json(res, 200, { itens: conta.convites });
  }

  if (rota("POST", "/empresa/convites")) {
    if (!gestao) return proibido();
    const { email, papel } = await corpoJson(req);
    const alvo = String(email ?? "").trim().toLowerCase();
    if (papel !== "gestor" && papel !== "analista") return json(res, 422, { detail: "Papel inválido." });
    if (eu.papel === "gestor" && papel !== "analista") return proibido("O gestor convida só analistas.");
    if (usuarios.has(alvo)) return json(res, 409, { detail: "Este e-mail já tem conta." });
    if (conta.convites.some((c) => c.email === alvo)) return json(res, 409, { detail: "Já há um convite pendente para este e-mail." });
    const convite = { id: randomUUID(), email: alvo, papel, criado_em: agora(), expira_em: new Date(Date.now() + 7 * 86400000).toISOString() };
    conta.convites.push(convite);
    const token = randomUUID();
    tokensDeConvite.set(token, { conta_id: conta.id, convite_id: convite.id });
    link(`convite para ${alvo}`, `${FRONT}/aceitar-convite#token=${token}`);
    return json(res, 201, convite);
  }

  const umConvite = rota("DELETE", /^\/empresa\/convites\/([^/]+)$/);
  if (umConvite) {
    if (!gestao) return proibido();
    conta.convites = conta.convites.filter((c) => c.id !== decodeURIComponent(umConvite[1]));
    return semCorpo();
  }

  // ----- importacao via IA (#224/#225): o bastante para ver as telas e remover uma linha. Um arquivo
  // com "erro" no conteudo volta com a tabela de erros; qualquer outro vira um rascunho de exemplo. -----

  if (rota("GET", "/importacoes-ia/prompt")) {
    return json(res, 200, { versao_schema: "1", versao_prompt: "1", prompt:
      "Você vai receber o PDF de um relatório de lançamentos de um sistema de gestão.\nLeia todas as páginas e devolva SOMENTE um JSON, sem texto antes ou depois, neste formato:\n{ \"versao_schema\": \"1\", \"lancamentos\": [ { \"data\": \"AAAA-MM-DD\", \"descricao\": \"…\", \"valor\": -120.50 } ] }\nRegras: uma entrada por lançamento; saída com valor negativo; ponto nos centavos; não some nem agrupe linhas." });
  }
  if (rota("POST", "/importacoes-ia")) {
    const pedacos = [];
    for await (const p of req) pedacos.push(p);
    if (Buffer.concat(pedacos).toString("utf8").includes("erro")) {
      return json(res, 422, { detail: "O arquivo não passou na conferência", erros: [
        { lancamento: 4, caminho: "lancamentos[3].valor", mensagem: "O valor precisa ser um número, com ponto nos centavos." },
        { lancamento: 7, caminho: "lancamentos[6].data", mensagem: "A data precisa estar no formato AAAA-MM-DD." },
        { lancamento: null, caminho: "", mensagem: "O arquivo não traz o campo versao_schema." } ] });
    }
    const id = randomUUID();
    importacoesIa.set(id, [["2026-10-01", "Mercado Sol · venda balcão", 1250], ["2026-10-01", "Tarifa bancária", -89.9],
      ["2026-10-02", "Moinho Sul · NF 4821", -3480], ["2026-10-03", "Cielo · recebíveis", 6212.45],
      ["2026-10-05", "Folha de outubro", -12400], ["2026-10-08", "iFood · repasse", 2845.3]]
      .map(([data, descricao, valor], i) => ({ id: randomUUID(), numero: i + 1, data, descricao, valor })));
    return json(res, 201, { importacao_id: id, quantidade_lancamentos: importacoesIa.get(id).length });
  }
  const umaImportacao = caminho.match(/^\/importacoes-ia\/([^/]+)$/);
  if (umaImportacao && metodo === "GET") {
    const itens = importacoesIa.get(umaImportacao[1]);
    if (!itens) return json(res, 404, { detail: "Importação não encontrada." });
    const soma = (f) => itens.filter(f).reduce((t, l) => t + l.valor, 0).toFixed(2);
    return json(res, 200, { importacao_id: umaImportacao[1], total: itens.length, itens, resumo: { quantidade: itens.length,
      total_entradas: soma((l) => l.valor > 0), total_saidas: soma((l) => l.valor < 0), periodo_inicio: itens[0]?.data ?? null,
      periodo_fim: itens.at(-1)?.data ?? null, expira_em: new Date(Date.now() + 7 * 864e5).toISOString() } });
  }
  const resumoIa = (itens) => {
    const soma = (f) => itens.filter(f).reduce((t, l) => t + l.valor, 0).toFixed(2);
    return { quantidade: itens.length, total_entradas: soma((l) => l.valor > 0), total_saidas: soma((l) => l.valor < 0),
      periodo_inicio: itens.map((l) => l.data).sort()[0] ?? null, periodo_fim: itens.map((l) => l.data).sort().at(-1) ?? null,
      expira_em: new Date(Date.now() + 7 * 864e5).toISOString() };
  };
  const linhasIa = rota("POST", /^\/importacoes-ia\/([^/]+)\/lancamentos$/);
  if (linhasIa) {
    const itens = importacoesIa.get(linhasIa[1]);
    if (!itens) return json(res, 404, { detail: "Importação não encontrada." });
    const c = await corpoJson(req);
    const lancamento = { id: randomUUID(), numero: itens.length + 1, data: c.data, descricao: c.descricao, valor: Number(c.valor) };
    itens.push(lancamento);
    return json(res, 201, { lancamento, resumo: resumoIa(itens) });
  }
  const editaLinhaIa = rota("PATCH", /^\/importacoes-ia\/([^/]+)\/lancamentos\/([^/]+)$/);
  if (editaLinhaIa) {
    const itens = importacoesIa.get(editaLinhaIa[1]) ?? [];
    const l = itens.find((x) => x.id === editaLinhaIa[2]);
    if (!l) return json(res, 404, { detail: "Lançamento não encontrado." });
    const c = await corpoJson(req);
    Object.assign(l, { data: c.data, descricao: c.descricao, valor: Number(c.valor) });
    return json(res, 200, { lancamento: l, resumo: resumoIa(itens) });
  }
  const confirmaIa = rota("POST", /^\/importacoes-ia\/([^/]+)\/confirmar$/);
  if (confirmaIa) {
    const itens = importacoesIa.get(confirmaIa[1]);
    if (!itens) return json(res, 404, { detail: "Importação não encontrada." });
    const lancamentos = itens.map((l) => ({ data: l.data, descricao: l.descricao, valor: l.valor.toFixed(2) }));
    const vistas = new Map();
    for (const l of lancamentos) {
      const k = `${l.valor}|${l.data}|${normalizar(l.descricao)}`;
      vistas.set(k, (vistas.get(k) ?? 0) + 1);
      Object.defineProperty(l, "ocorrencia", { value: vistas.get(k) });
    }
    const datas = lancamentos.map((l) => l.data).sort();
    const extratoId = randomUUID();
    b.extratos.set(extratoId, { origem: "sistema", nome: "Importação via IA", formato: "csv", lancamentos, erros: [],
      periodoInicio: datas[0] ?? null, periodoFim: datas.at(-1) ?? null, enviadoEm: agora() });
    importacoesIa.delete(confirmaIa[1]);
    return json(res, 200, { extrato_id: extratoId });
  }
  if (umaImportacao && metodo === "DELETE") {
    importacoesIa.delete(umaImportacao[1]);
    return semCorpo();
  }
  const umaLinhaIa = rota("DELETE", /^\/importacoes-ia\/([^/]+)\/lancamentos\/([^/]+)$/);
  if (umaLinhaIa) {
    const itens = importacoesIa.get(umaLinhaIa[1]) ?? [];
    const posicao = itens.findIndex((l) => l.id === umaLinhaIa[2]);
    if (posicao < 0) return json(res, 404, { detail: "Lançamento não encontrado." });
    itens.splice(posicao, 1);
    return semCorpo();
  }

  // ----- chaves da API (#135) e conexoes MCP (#136) -----

  if (caminho.startsWith("/chaves-api") && !gestao) return proibido("Só o admin ou o gestor gerenciam chaves da API.");
  if (rota("GET", "/chaves-api")) return json(res, 200, { itens: conta.chaves.map((c) => chaveApi(conta, c)) });
  if (rota("POST", "/chaves-api")) {
    const { nome, empresa_id } = await corpoJson(req);
    if (conta.chaves.filter((c) => !c.revogada_em).length >= 10) return json(res, 409, { detail: "A conta já tem 10 chaves ativas. Revogue uma antes." });
    if (empresa_id && !conta.empresas.includes(empresa_id)) return json(res, 422, { detail: "Empresa fora da conta." });
    const segredo = randomUUID().replace(/-/g, "");
    const c = { id: randomUUID(), nome: String(nome).trim(), prefixo: segredo.slice(0, 8), empresa_id: empresa_id ?? null,
      criada_por: eu.nome, criado_em: agora(), ultimo_uso_em: null, revogada_em: null };
    conta.chaves.unshift(c);
    return json(res, 201, { ...chaveApi(conta, c), chave: `ledgr_${c.prefixo}_${segredo.slice(8)}` });
  }
  const umaChave = rota("DELETE", /^\/chaves-api\/([^/]+)$/);
  if (umaChave) {
    const c = conta.chaves.find((x) => x.id === umaChave[1]);
    if (!c) return json(res, 404, { detail: "Chave não encontrada." });
    c.revogada_em ??= agora();
    return semCorpo();
  }

  // com MCP_HABILITADO desligado, o backend responde 404 em todas as rotas de conexão
  if (!MCP && caminho.startsWith("/conexoes-mcp")) return json(res, 404, { detail: "Not Found" });
  const pedido = caminho.match(/^\/conexoes-mcp\/pedidos\/([^/]+)(\/aprovar|\/recusar)?$/);
  if (pedido) {
    const p = pedidosMcp.get(pedido[1]);
    if (!p || Date.parse(p.expira_em) < Date.now()) return json(res, 404, { detail: "Pedido não encontrado ou expirado." });
    if (metodo === "GET") {
      return json(res, 200, { cliente: p.cliente, origem: { host: p.host, loopback: p.loopback }, escopo: "leitura",
        descricao_escopo: "Ler extratos, conciliações e fechamentos da empresa escolhida. Não altera nada.", expira_em: p.expira_em,
        empresas: conta.empresas.map((id) => empresas.get(id)).map(({ id, razao_social, cnpj }) => ({ id, razao_social, cnpj })) });
    }
    pedidosMcp.delete(pedido[1]);
    if (pedido[2] === "/recusar") return json(res, 200, { redirecionar_para: `${p.redirect}?error=access_denied&state=${p.state}` });
    if (!gestao) return proibido("Só o admin ou o gestor autorizam conexões.");
    const { empresa_id } = await corpoJson(req);
    if (!conta.empresas.includes(empresa_id)) return json(res, 422, { detail: "Escolha uma empresa da conta." });
    if (conta.conexoes.filter((c) => !c.revogada_em).length >= 10) return json(res, 409, { detail: "A conta já tem 10 conexões ativas." });
    conta.conexoes.unshift({ id: randomUUID(), cliente: p.cliente, empresa_id, criada_por: eu.nome, criado_em: agora(), ultimo_uso_em: null, revogada_em: null });
    return json(res, 200, { redirecionar_para: `${p.redirect}?code=${randomUUID()}&state=${p.state}` });
  }
  if (caminho.startsWith("/conexoes-mcp") && !gestao) return proibido("Só o admin ou o gestor veem as conexões.");
  if (rota("GET", "/conexoes-mcp")) return json(res, 200, { itens: conta.conexoes.map(conexao) });
  const umaConexao = rota("DELETE", /^\/conexoes-mcp\/([^/]+)$/);
  if (umaConexao) {
    const c = conta.conexoes.find((x) => x.id === umaConexao[1]);
    if (!c) return json(res, 404, { detail: "Conexão não encontrada." });
    c.revogada_em ??= agora();
    return semCorpo();
  }

  if (rota("POST", "/assistente/perguntas")) {
    const { pergunta } = await corpoJson(req);
    if (!pergunta || String(pergunta).length > 500) return json(res, 422, { detail: "Pergunta vazia ou longa demais." });
    const resposta = await responderPergunta(String(pergunta));
    return resposta ? json(res, 200, resposta) : json(res, 503, { detail: "Assistente indisponível." });
  }

  // ----- dados da empresa ativa -----

  if (caminho === "/empresa/configuracoes") {
    if (metodo === "PUT") {
      const { tolerancia_dias } = await corpoJson(req);
      if (!Number.isInteger(tolerancia_dias) || tolerancia_dias < 0 || tolerancia_dias > TOLERANCIA_MAXIMA) {
        return json(res, 422, { detail: `A tolerância vai de 0 a ${TOLERANCIA_MAXIMA} dias.` });
      }
      Object.assign(b.configuracoes, { tolerancia_dias, atualizado_por: eu.nome, atualizado_em: agora() });
    }
    return json(res, 200, { ...b.configuracoes, tolerancia_dias_maximo: TOLERANCIA_MAXIMA });
  }

  // POST /extratos/upload — multipart com `arquivo` e `origem`
  if (rota("POST", "/extratos/upload")) {
    const partes = multipart(req, await corpoBruto(req));
    const origem = partes.origem?.bytes.toString("utf8").trim();
    if (origem !== "banco" && origem !== "sistema") return json(res, 422, { detail: "Campo origem obrigatorio." });
    const nome = partes.arquivo?.filename ?? "extrato.csv";
    if (!/\.(ofx|csv)$/i.test(nome)) return json(res, 400, { detail: "Formato não suportado. Envie .ofx ou .csv." });
    try {
      return json(res, 200, { extrato_id: registrarExtrato(b, nome, origem, partes.arquivo.bytes), status: "pendente" });
    } catch (erro) {
      return json(res, 400, { detail: erro.message });
    }
  }

  if (rota("GET", "/extratos")) {
    const conciliados = new Set(b.execucoes.flatMap((e) => [e.extrato_banco_id, e.extrato_sistema_id]));
    const lista = [...b.extratos]
      .filter(([, e]) => !q.get("origem") || e.origem === q.get("origem"))
      .sort(([, x], [, y]) => y.enviadoEm.localeCompare(x.enviadoEm))
      .map(([id, e]) => ({
        extrato_id: id,
        nome_arquivo: e.nome,
        origem: e.origem,
        formato: e.formato,
        // como o backend (#13): linha rejeitada deixa o extrato `concluido_com_erros`
        status: e.erros.length ? "concluido_com_erros" : "concluido",
        quantidade_lancamentos: e.lancamentos.length,
        linhas_nao_lidas: e.erros.length,
        periodo_inicio: e.periodoInicio,
        periodo_fim: e.periodoFim,
        enviado_em: e.enviadoEm,
        conciliado: conciliados.has(id),
      }));
    return json(res, 200, pagina(lista));
  }

  const extrato = rota("GET", /^\/extratos\/([0-9a-f-]{36})$/i);
  if (extrato) {
    const dados = b.extratos.get(extrato[1]);
    if (!dados) return json(res, 404, { detail: "Extrato nao encontrado." });
    return json(res, 200, {
      extrato_id: extrato[1],
      status: dados.erros.length ? "concluido_com_erros" : "concluido",
      origem: dados.origem,
      quantidade_lancamentos: dados.lancamentos.length,
      periodo_inicio: dados.periodoInicio,
      periodo_fim: dados.periodoFim,
      erros: dados.erros,
    });
  }

  if (rota("POST", "/conciliacoes")) {
    const corpo = await corpoJson(req);
    const banco = b.extratos.get(corpo.extrato_banco_id);
    if (banco?.periodoInicio && fechamentoAtivo(b, banco.periodoInicio.slice(0, 7))) {
      return json(res, 409, { detail: "Este mês está fechado. Reabra o mês para conciliar de novo." });
    }
    const contagens = executar(b, corpo.extrato_banco_id, corpo.extrato_sistema_id);
    if (!contagens) return json(res, 404, { detail: "Extrato nao encontrado." });
    return json(res, 200, { extrato_banco_id: corpo.extrato_banco_id, extrato_sistema_id: corpo.extrato_sistema_id, ...contagens });
  }

  const decisao = rota("POST", /^\/conciliacoes\/([0-9a-f-]{36})\/decisoes$/i);
  if (decisao) {
    const { chave, tipo, texto } = await corpoJson(req);
    const r = decidir(b, eu, decisao[1], chave, tipo, texto);
    return json(res, r.status, r.corpo);
  }

  if (rota("POST", "/justificativas/lote")) {
    if (!gestao) return proibido("Só o admin ou o gestor aprovam justificativas.");
    const { acao, competencia, itens: alvos, motivo } = await corpoJson(req);
    if (acao !== "aprovar" && acao !== "rejeitar") return json(res, 422, { detail: "Ação inválida." });
    const chaves = alvos
      ? alvos.map((i) => `${i.extrato_banco_id}|${i.chave}`)
      : [...b.decisoes.keys()].filter((k) => b.extratos.get(k.split("|")[0])?.periodoInicio?.startsWith(competencia));
    let processadas = 0;
    for (const k of chaves) {
      const [bancoId, chave] = k.split("|");
      const r = decidir(b, eu, bancoId, chave, acao === "aprovar" ? "justificativa_aprovada" : "justificativa_rejeitada", motivo);
      if (r.status === 200) processadas++;
    }
    return json(res, 200, { processadas, ignoradas: chaves.length - processadas });
  }

  const conciliacao = rota("GET", /^\/conciliacoes\/([0-9a-f-]{36})(\/exportar)?$/i);
  if (conciliacao) {
    const [, bancoId, exportar] = conciliacao;
    const sistemaId = q.get("extrato_sistema_id");
    const status = q.get("status");
    const encontradas = [...b.itens.entries()]
      .filter(([chave]) => chave.startsWith(`${bancoId}|`) && (!sistemaId || chave.endsWith(`|${sistemaId}`)))
      .flatMap(([, lista]) => lista)
      .filter((item) => !status || item.status === status)
      .map((item) => {
        const registro = b.decisoes.get(`${bancoId}|${item.chave}`);
        return { ...item, decisao: registro?.decisao ?? null, eventos: registro?.eventos ?? [] };
      });
    if (![...b.itens.keys()].some((k) => k.startsWith(`${bancoId}|`))) {
      return json(res, 404, { detail: "Conciliacao nao encontrada." });
    }
    if (exportar) {
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="conciliacao-${bancoId.slice(0, 8)}.csv"`,
      });
      return res.end(Buffer.from(csv(encontradas), "utf8"));
    }
    const lim = Number(q.get("limit") ?? 100);
    return json(res, 200, { extrato_id: bancoId, total: encontradas.length, limit: lim, offset,
      aguardando_aprovacao: encontradas.filter((i) => i.decisao?.situacao === "pendente").length,
      itens: encontradas.slice(offset, offset + lim) });
  }

  // POST /explicacoes — texto fixo, sem IA; a tela so precisa do formato
  if (rota("POST", "/explicacoes")) {
    const { conciliacao_id } = await corpoJson(req);
    const item = [...b.itens.values()].flat().find((i) => i.id === conciliacao_id);
    if (!item) return json(res, 404, { detail: "Conciliacao nao encontrada." });
    const lb = item.lancamento_banco;
    const ls = item.lancamento_sistema;
    return json(res, 200, {
      conciliacao_id,
      status: item.status,
      explicacao: `(backend fake) Linha classificada como ${item.status}: banco ${lb?.valor ?? "—"} em ${lb?.data ?? "—"}, sistema ${ls?.valor ?? "—"} em ${ls?.data ?? "—"}.`,
      gerada_por_ia: false,
      em_cache: false,
      indisponibilidade: "desabilitado",
    });
  }

  if (rota("GET", "/execucoes")) {
    const banco = q.get("extrato_banco_id");
    return json(res, 200, pagina(b.execucoes.filter((e) => !banco || e.extrato_banco_id === banco).map((e) => comDecisoes(b, e))));
  }

  if (rota("GET", "/fechamentos")) {
    const competencia = q.get("competencia");
    const lista = [...b.fechamentos.entries()]
      .filter(([c]) => !competencia || c === competencia)
      .flatMap(([, registros]) => registros)
      .sort((x, y) => y.fechado_em.localeCompare(x.fechado_em));
    return json(res, 200, { itens: lista.map(respostaFechamento) });
  }
  if (rota("POST", "/fechamentos")) {
    if (!gestao) return proibido("Só o admin ou o gestor fecham o mês.");
    const { competencia, ressalva: bruta } = await corpoJson(req);
    const ressalva = String(bruta ?? "").trim() || null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia ?? "")) {
      return json(res, 422, { detail: "A competência deve estar no formato AAAA-MM, com mês de 01 a 12." });
    }
    if (fechamentoAtivo(b, competencia)) return json(res, 409, { detail: "Esta competência já está fechada." });
    const resumo = resumoDoMes(b, competencia);
    if (!resumo.pares.length) return json(res, 422, { detail: "Não há conciliação nesta competência." });
    if (resumo.aguardando_aprovacao) {
      return json(res, 409, { detail: `Há ${resumo.aguardando_aprovacao} justificativa(s) aguardando aprovação. Aprove ou rejeite antes de fechar.` });
    }
    if ((resumo.pendentes || resumo.linhas_nao_lidas) && !ressalva) {
      const partes = [
        resumo.pendentes && `${resumo.pendentes} ${resumo.pendentes === 1 ? "divergência sem justificativa" : "divergências sem justificativa"}`,
        resumo.linhas_nao_lidas && `${resumo.linhas_nao_lidas} ${resumo.linhas_nao_lidas === 1 ? "linha não lida" : "linhas não lidas"}`,
      ].filter(Boolean);
      return json(res, 409, { detail: `Há ${partes.join(" e ")} nesta competência. Justifique, corrija ou feche com ressalva.` });
    }
    return json(res, 201, respostaFechamento(fechar(b, competencia, ressalva, eu.nome)));
  }
  const reabrir = rota("DELETE", /^\/fechamentos\/(\d{4}-\d{2})$/);
  if (reabrir) {
    if (!gestao) return proibido("Só o admin ou o gestor reabrem o mês.");
    const ativo = fechamentoAtivo(b, reabrir[1]);
    if (!ativo) return json(res, 404, { detail: "Esta competência não está fechada." });
    Object.assign(ativo, { reaberto_por: eu.nome, reaberto_em: agora() });
    return json(res, 200, respostaFechamento(ativo));
  }

  json(res, 404, { detail: `Sem rota para ${metodo} ${caminho}.` });
});

// ---------- carga inicial ----------

let arquivos = [];
try {
  arquivos = readdirSync(PASTA_EXEMPLOS).sort();
} catch {
  console.log(`(sem ${PASTA_EXEMPLOS}: as empresas sobem vazias)`);
}
// Cada `-vN` do sistema e uma rodada a mais do mesmo extrato do banco, dois dias depois.
const versao = (nome) => Number(nome.match(/-v(\d+)\./)?.[1] ?? 1);
const isoSemMs = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

/** Cada par `NN-mes-banco-*.ofx` + `NN-mes-sistema-*.csv` dos meses pedidos, enviado e conciliado dias depois do fim do mes. */
function carregarExemplos(b, meses, fator = 1) {
  for (const nomeBanco of arquivos.filter((n) => n.includes("-banco-") && meses.includes(Number(n.slice(0, 2))))) {
    const prefixo = nomeBanco.split("-banco-")[0];
    const nomesSistema = arquivos.filter((n) => n.startsWith(`${prefixo}-sistema-`)).sort((x, y) => versao(x) - versao(y));
    if (!nomesSistema.length) continue;
    const bancoId = registrarExtrato(b, nomeBanco, "banco", readFileSync(join(PASTA_EXEMPLOS, nomeBanco)), agora(), fator);
    const fim = b.extratos.get(bancoId).periodoFim ?? new Date().toISOString().slice(0, 10);
    nomesSistema.forEach((nomeSistema, i) => {
      // o mes corrente nao pode ter sido enviado nem conciliado no futuro
      const enviadoMs = Math.min(
        Date.parse(`${fim}T13:00:00Z`) + (5 + 2 * i) * 86400000,
        Date.now() - 2 * 3600000 * (nomesSistema.length - i),
      );
      if (i === 0) b.extratos.get(bancoId).enviadoEm = isoSemMs(enviadoMs);
      const sistemaId = registrarExtrato(b, nomeSistema, "sistema", readFileSync(join(PASTA_EXEMPLOS, nomeSistema)), isoSemMs(enviadoMs), fator);
      executar(b, bancoId, sistemaId, isoSemMs(enviadoMs + 3600000));
    });
  }
}

/** Fecha os meses (dia 10 do mes seguinte), com ressalva quando sobrou pendencia. */
function fecharMeses(b, meses, autor) {
  for (const mes of meses) {
    const competencia = `2026-${String(mes).padStart(2, "0")}`;
    const resumo = resumoDoMes(b, competencia);
    if (!resumo.pares.length) continue;
    fechar(b, competencia, resumo.pendentes ? "Pendências conhecidas, conferidas com o cliente." : null, autor,
      isoSemMs(Date.UTC(2026, mes, 10, 15)));
  }
}

/** Decisoes de exemplo nas divergencias do extrato do banco de um mes, para a aprovacao ter o que mostrar. */
function semearDecisoes(b, mes, quem) {
  const exec = b.execucoes.find((e) => competenciaDe(e) === `2026-${String(mes).padStart(2, "0")}`);
  if (!exec) return;
  const divergentes = b.itens.get(`${exec.extrato_banco_id}|${exec.extrato_sistema_id}`).filter((i) => !i.status.startsWith("match_"));
  const plano = [
    [quem.admin, "conferida"],
    [quem.gestor, "justificada", "Tarifa do pacote de serviços, prevista no contrato com o banco."],
    [quem.analista, "justificada", "Pagamento lançado no ERP com a data da nota; o banco compensou depois."],
    [quem.analista, "justificada", "Estorno combinado com o fornecedor, entra no mês que vem."],
  ];
  plano.forEach(([autor, tipo, texto], i) => {
    if (divergentes[i]) decidir(b, autor, exec.extrato_banco_id, divergentes[i].chave, tipo, texto, isoSemMs(Date.parse(exec.executada_em) + (i + 1) * 3600000));
  });
}

// Conta 1 (plano Padrao, ativa): o escritorio da Telha Certa, com tres empresas clientes e os tres papeis.
const escritorio = novaConta("c0000000-0000-4000-8000-000000000001", "Telha Certa", "ativo", "padrao");
const telha = novaEmpresa(escritorio, "e0000000-0000-4000-8000-000000000001", "Telha Certa Materiais de Construção Ltda", "12345678000195");
const horizonte = novaEmpresa(escritorio, "e0000000-0000-4000-8000-000000000002", "Construtora Horizonte Ltda", "11222333000181");
novaEmpresa(escritorio, "e0000000-0000-4000-8000-000000000003", "Padaria Pão Quente ME", "45997418000153");
const quem = {
  admin: novoUsuario(escritorio, "d0000000-0000-4000-8000-000000000001", "Financeiro", "financeiro@telhacerta.com.br", "admin"),
  gestor: novoUsuario(escritorio, "d0000000-0000-4000-8000-000000000002", "Gabriela Gestora", "gestor@telhacerta.com.br", "gestor"),
  analista: novoUsuario(escritorio, "d0000000-0000-4000-8000-000000000003", "André Analista", "analista@telhacerta.com.br", "analista"),
};
carregarExemplos(telha, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
fecharMeses(telha, [1, 2, 3, 4, 5, 6, 7, 8], quem.admin.nome);
semearDecisoes(telha, 10, quem);
semearDecisoes(telha, 9, quem);
// a Horizonte tem o mesmo movimento em outra escala, de junho em diante; a padaria comeca vazia
carregarExemplos(horizonte, [6, 7, 8, 9, 10], 1.37);
fecharMeses(horizonte, [6, 7], quem.gestor.nome);

escritorio.chaves.push(
  { id: randomUUID(), nome: "Planilha do BI", prefixo: "a1b2c3d4", empresa_id: telha.id, criada_por: quem.admin.nome,
    criado_em: "2026-10-05T14:00:00Z", ultimo_uso_em: "2026-10-25T09:12:00Z", revogada_em: null },
  { id: randomUUID(), nome: "Teste antigo", prefixo: "9f8e7d6c", empresa_id: null, criada_por: quem.gestor.nome,
    criado_em: "2026-09-02T10:00:00Z", ultimo_uso_em: null, revogada_em: "2026-09-20T18:30:00Z" },
);
escritorio.conexoes.push({ id: randomUUID(), cliente: "ChatGPT", empresa_id: telha.id, criada_por: quem.admin.nome,
  criado_em: "2026-10-12T16:40:00Z", ultimo_uso_em: "2026-10-24T11:05:00Z", revogada_em: null });

// Conta 2 (teste gratis acabando): uma empresa so, vazia, para o primeiro uso e a faixa do teste.
const padaria = novaConta("c0000000-0000-4000-8000-000000000002", "Doce Sabor", "teste", "essencial", emDias(3));
novaEmpresa(padaria, "e0000000-0000-4000-8000-000000000004", "Doce Sabor Confeitaria Ltda", "33444555000172");
novoUsuario(padaria, "d0000000-0000-4000-8000-000000000004", "Dona Clara", "teste@docesabor.com.br", "admin");

// Contas so para os avisos de plano: teste acabado (o app troca a nova conciliacao pelos planos) e
// plano Essencial acima do limite (1 empresa, 2 pessoas), com uma empresa a mais e a equipe cheia.
const encerrada = novaConta("c0000000-0000-4000-8000-000000000003", "Bom Preço", "teste_encerrado", "padrao", emDias(-2));
carregarExemplos(novaEmpresa(encerrada, "e0000000-0000-4000-8000-000000000005", "Bom Preço Supermercados Ltda", "22333444000106"), [9, 10], 0.8);
novoUsuario(encerrada, "d0000000-0000-4000-8000-000000000005", "Seu Jorge", "encerrado@bompreco.com.br", "admin");
const apertada = novaConta("c0000000-0000-4000-8000-000000000004", "Auto Peças Rota", "ativo", "essencial");
carregarExemplos(novaEmpresa(apertada, "e0000000-0000-4000-8000-000000000006", "Auto Peças Rota Ltda", "55666777000190"), [10], 1.2);
novaEmpresa(apertada, "e0000000-0000-4000-8000-000000000007", "Rota Oficina Mecânica ME", "66777888000123");
novoUsuario(apertada, "d0000000-0000-4000-8000-000000000006", "Marta", "limite@autopecasrota.com.br", "admin");
novoUsuario(apertada, "d0000000-0000-4000-8000-000000000007", "Paulo", "paulo@autopecasrota.com.br", "analista");
// e uma recem-cadastrada, sem plano: o app manda escolher em /plano
const semPlano = novaConta("c0000000-0000-4000-8000-000000000005", "Café Aroma", "sem_plano", null);
novaEmpresa(semPlano, "e0000000-0000-4000-8000-000000000008", "Café Aroma Ltda", "77888999000145");
novoUsuario(semPlano, "d0000000-0000-4000-8000-000000000008", "Lia", "semplano@cafearoma.com.br", "admin");

servidor.listen(PORTA, () => {
  console.log(`backend-fake em http://localhost:${PORTA} — senha de todas as contas: ${SENHA_PADRAO}`);
  for (const u of usuarios.values()) console.log(`  ${u.papel.padEnd(8)} ${u.email}  (${contas.get(u.conta_id).nome})`);
  for (const id of escritorio.empresas) {
    const e = empresas.get(id);
    console.log(`  empresa ${e.razao_social}: ${e.execucoes.length} execucoes, ${[...e.fechamentos.keys()].length} meses fechados`);
  }
  // um convite e um pedido de conexao prontos para testar as telas publicas
  const convite = { id: randomUUID(), email: "novo.analista@telhacerta.com.br", papel: "analista", criado_em: agora(),
    expira_em: new Date(Date.now() + 7 * 86400000).toISOString() };
  escritorio.convites.push(convite);
  const token = randomUUID();
  tokensDeConvite.set(token, { conta_id: escritorio.id, convite_id: convite.id });
  link(`convite para ${convite.email}`, `${FRONT}/aceitar-convite#token=${token}`);
  novoPedidoMcp("Claude");
  console.log(`  outro pedido de conexao: GET http://localhost:${PORTA}/dev/pedido-mcp`);
});
