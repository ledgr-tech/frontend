"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, demoAberta, ehContaDeDemonstracao } from "@/lib/demo";
import { COOKIE_CADASTRO_GOOGLE, COOKIE_CONVITE_GOOGLE, VALIDADE_ID_TOKEN_SEGUNDOS } from "@/lib/google";
import { MuitasEntradas, type UsuarioAPI } from "@/lib/login";
import type { EmpresaDaConta } from "@/lib/empresa-ativa";
import { lerPapel, type Papel } from "@/lib/papel";
import { ehTela, type Preferencias } from "@/lib/preferencias";
import { adaptarAssinatura, type Assinatura, type PlanoId } from "@/lib/assinatura";
import { adaptarLimites, type LimitesDaConta } from "@/lib/limites";
import { adaptarConsultaConvite, type ConsultaConvite, type ConsultaConviteAPI } from "@/lib/adaptadores";

/**
 * Abrir e fechar sessão, e criar conta. Vive numa Server Action porque o
 * cookie do NextAuth é httpOnly: o JavaScript do navegador não escreve nem lê
 * esse cookie — é a propriedade que a decisão da Sprint 2 pediu pro token
 * nunca ficar exposto.
 *
 * Quem confere a senha é o backend (`POST /login`), dentro do `authorize` do
 * NextAuth (`lib/login.ts`); daqui sai só o motivo da recusa.
 */

const COOKIES_SESSAO = ["__Secure-authjs.session-token", "authjs.session-token"];

export type ErroEntrada = "credenciais_invalidas" | "muitas_tentativas" | "falha_sessao";

export type ResultadoEntrada = { ok: true } | { ok: false; erro: ErroEntrada };

/**
 * Sem "manter sessão ativa", o cookie perde o Max-Age e morre com o navegador.
 *
 * O NextAuth grava sempre com Max-Age de 7 dias e não aceita decidir isso por
 * login, então o jeito é reescrever o cookie depois — mesmo valor, sem
 * expiração. O token em si continua valendo 7 dias; o que muda é até quando o
 * navegador guarda.
 */
async function tornarCookieDeSessao(): Promise<void> {
  const pote = await cookies();
  for (const nome of COOKIES_SESSAO) {
    const atual = pote.get(nome);
    if (!atual) continue;
    pote.set(nome, atual.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: nome.startsWith("__Secure-"),
    });
  }
}

export async function entrar(
  email: string,
  senha: string,
  manterSessao: boolean,
): Promise<ResultadoEntrada> {
  try {
    await signIn("credentials", { email, senha, redirect: false });
  } catch (erro) {
    // O `authorize` só recusa com `CredentialsSignin`: 429 é `MuitasEntradas`,
    // 401 é o próprio. O resto — backend fora do ar, NEXTAUTH_SECRET faltando —
    // não é culpa de quem digitou.
    if (erro instanceof MuitasEntradas) return { ok: false, erro: "muitas_tentativas" };
    if (erro instanceof CredentialsSignin) return { ok: false, erro: "credenciais_invalidas" };
    return { ok: false, erro: "falha_sessao" };
  }
  if (!manterSessao) await tornarCookieDeSessao();
  return { ok: true };
}

/**
 * O atalho do botão do Google: entra na conta de demonstração, que é uma conta
 * de verdade no backend, com e-mail e senha só no ambiente do servidor.
 * Esconder o botão não basta — uma Server Action pode ser chamada direto —,
 * então a recusa é aqui.
 */
export async function entrarNaDemonstracao(manterSessao: boolean): Promise<boolean> {
  const email = process.env.LEDGR_CONTA_TESTE_EMAIL?.trim();
  const senha = process.env.LEDGR_CONTA_TESTE_SENHA;
  if (!demoAberta() || !email || !senha) return false;
  return (await entrar(email, senha, manterSessao)).ok;
}

/**
 * "Entrar com Google" (backend #73): leva ao Google, e a volta passa pelo
 * callback `signIn` do `auth.ts`. O `signIn` do NextAuth sai lançando o
 * redirect, que a Server Action entrega ao navegador; só volta daqui quando o
 * provider não existe neste servidor.
 */
export async function entrarComGoogle(): Promise<false> {
  if (!process.env.AUTH_GOOGLE_ID) return false;
  // um aceite de convite pelo Google que ficou pela metade não pode virar este login
  (await cookies()).delete(COOKIE_CONVITE_GOOGLE);
  await signIn("google", { redirectTo: "/visao-geral" });
  return false;
}

/** Os campos do formulário que o `POST /register` recebe. */
export type DadosCadastro = {
  nome: string;
  email: string;
  senha: string;
  razaoSocial: string;
  cnpj: string;
};

export type CampoCadastroAPI = keyof DadosCadastro;

export type ResultadoCadastro =
  /** `entrou: false` é conta criada com a sessão que não abriu: falta só entrar. */
  | { ok: true; entrou: boolean }
  | {
      ok: false;
      erro:
        | "email_cadastrado"
        | "cnpj_cadastrado"
        /** A Receita não conhece o CNPJ, ou ele não está ativo (backend #119): o cadastro não segue com ele. */
        | "cnpj_nao_encontrado"
        | "cnpj_inativo"
        | "muitas_tentativas"
        | "falha"
        /** Só no cadastro pelo Google: o `id_token` venceu (1 hora) ou sumiu, e é preciso passar pelo Google de novo. */
        | "google_expirado"
        | "google_ja_cadastrado"
        | "google_indisponivel";
    }
  /** O backend recusou o formato: são os campos a corrigir, com o nome do formulário. */
  | { ok: false; erro: "invalido"; campos: CampoCadastroAPI[] };

const CAMPO_DO_FORMULARIO: Record<string, CampoCadastroAPI> = {
  nome: "nome",
  email: "email",
  senha: "senha",
  razao_social: "razaoSocial",
  cnpj: "cnpj",
};

/**
 * Os dois 422 do CNPJ na Receita (backend #119) chegam no mesmo formato da recusa de formato, com
 * `loc` no `cnpj`: só a `msg` os separa. O texto é o contrato, como o dos 409.
 */
function recusaDaReceita(erro: ErroBackend): "cnpj_nao_encontrado" | "cnpj_inativo" | null {
  const mensagem = erro.mensagens?.cnpj ?? "";
  if (mensagem.startsWith("CNPJ não encontrado na Receita")) return "cnpj_nao_encontrado";
  if (mensagem.startsWith("CNPJ não está ativo na Receita")) return "cnpj_inativo";
  return null;
}

/**
 * Cria empresa e usuário numa chamada só (`POST /register`) e já entra com a
 * mesma senha. O sistema de gestão, que o formulário também pede, o backend
 * ainda não guarda: fica no navegador.
 */
export async function cadastrar(dados: DadosCadastro): Promise<ResultadoCadastro> {
  try {
    await chamarBackend<UsuarioAPI>("/register", {
      method: "POST",
      corpo: {
        nome: dados.nome,
        email: dados.email,
        senha: dados.senha,
        razao_social: dados.razaoSocial,
        cnpj: dados.cnpj,
      },
      publica: true,
    });
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    if (erro.status === 422) {
      const receita = recusaDaReceita(erro);
      if (receita) return { ok: false, erro: receita };
    }
    if (erro.status === 422 && erro.campos.length > 0) {
      const campos = erro.campos.map((campo) => CAMPO_DO_FORMULARIO[campo]).filter(Boolean);
      if (campos.length > 0) return { ok: false, erro: "invalido", campos };
    }
    // As duas mensagens de 409 são o contrato: "E-mail já cadastrado." e "CNPJ
    // já cadastrado.". Uma terceira, "E-mail ou CNPJ já cadastrado.", só sai
    // de dois cadastros simultâneos — tentar de novo traz a exata.
    if (erro.status === 409 && erro.detalhe.startsWith("E-mail já")) {
      return { ok: false, erro: "email_cadastrado" };
    }
    if (erro.status === 409 && erro.detalhe.startsWith("CNPJ já")) {
      return { ok: false, erro: "cnpj_cadastrado" };
    }
    return { ok: false, erro: "falha" };
  }
  const sessao = await entrar(dados.email, dados.senha, true);
  return { ok: true, entrou: sessao.ok };
}

/**
 * O CNPJ na Receita (backend #119). `nao_verificado` é "não deu para saber" (consulta desligada,
 * BrasilAPI fora, CNPJ já cadastrado) e nunca bloqueia.
 */
export type SituacaoCnpj = "ativa" | "inativa" | "nao_encontrado" | "nao_verificado";

const SITUACOES_CNPJ: readonly SituacaoCnpj[] = ["ativa", "inativa", "nao_encontrado", "nao_verificado"];

/**
 * O fim do cadastro de quem voltou do Google sem conta (`POST /register/google`,
 * backend #73): o `id_token` sai do cookie httpOnly que o callback do Google
 * gravou, e o e-mail é o da conta Google. O backend já trata isso como login,
 * mas a sessão do NextAuth abre pelo provider `google-cadastro`, com o mesmo
 * `id_token`.
 */
export async function cadastrarComGoogle(
  dados: Pick<DadosCadastro, "nome" | "razaoSocial" | "cnpj">,
): Promise<ResultadoCadastro> {
  const pote = await cookies();
  const idToken = pote.get(COOKIE_CADASTRO_GOOGLE)?.value;
  if (!idToken) return { ok: false, erro: "google_expirado" };
  try {
    await chamarBackend<UsuarioAPI>("/register/google", {
      method: "POST",
      corpo: {
        id_token: idToken,
        razao_social: dados.razaoSocial,
        cnpj: dados.cnpj,
        // sem nome, o backend usa o da conta Google; vazio ele recusa
        ...(dados.nome && { nome: dados.nome }),
      },
      publica: true,
    });
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 401) {
      pote.delete(COOKIE_CADASTRO_GOOGLE);
      return { ok: false, erro: "google_expirado" };
    }
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    if (erro.status === 503) return { ok: false, erro: "google_indisponivel" };
    if (erro.status === 422) {
      const receita = recusaDaReceita(erro);
      if (receita) return { ok: false, erro: receita };
      const campos = erro.campos.map((campo) => CAMPO_DO_FORMULARIO[campo]).filter(Boolean);
      if (campos.length > 0) return { ok: false, erro: "invalido", campos };
    }
    if (erro.status === 409 && erro.detalhe.startsWith("E-mail já")) return { ok: false, erro: "email_cadastrado" };
    if (erro.status === 409 && erro.detalhe.startsWith("CNPJ já")) return { ok: false, erro: "cnpj_cadastrado" };
    if (erro.status === 409) return { ok: false, erro: "google_ja_cadastrado" };
    return { ok: false, erro: "falha" };
  }
  try {
    await signIn("google-cadastro", { redirect: false });
  } catch {
    return { ok: true, entrou: false };
  }
  return { ok: true, entrou: true };
}

export type ResultadoVerificacao =
  | {
      ok: true;
      emailDisponivel: boolean;
      cnpjDisponivel: boolean;
      /** `nao_verificado` também quando o backend ainda não manda o campo (antes do #119). */
      cnpjSituacao: SituacaoCnpj;
      /** A razão social que a Receita devolveu; null sem ela. */
      razaoSocialReceita: string | null;
    }
  /** O backend recusou o formato, com as mesmas regras do `POST /register`. */
  | { ok: false; erro: "invalido"; campos: CampoCadastroAPI[] }
  /** Sem resposta que sirva (limite por minuto, backend sem a rota, fora do ar): o cadastro segue. */
  | { ok: false; erro: "indisponivel" };

/**
 * Confere se o e-mail e o CNPJ ainda estão livres antes do fim do cadastro
 * (`POST /register/verificar`, backend #80). A rota recebe os dois juntos, por
 * isso a tela chama ao sair do passo da empresa. Não cria nada: o `/register`
 * confere tudo de novo no fim, e o 409 dele continua cobrindo quem cadastrar o
 * mesmo e-mail no meio do caminho.
 */
export async function verificarCadastro(
  dados: Pick<DadosCadastro, "email" | "cnpj">,
): Promise<ResultadoVerificacao> {
  try {
    const resposta = await chamarBackend<{
      email_disponivel: boolean;
      cnpj_disponivel: boolean;
      cnpj_situacao?: unknown;
      razao_social?: unknown;
    }>("/register/verificar", { method: "POST", corpo: { email: dados.email, cnpj: dados.cnpj }, publica: true });
    const situacao = SITUACOES_CNPJ.find((valor) => valor === resposta.cnpj_situacao) ?? "nao_verificado";
    const razaoSocial = typeof resposta.razao_social === "string" ? resposta.razao_social.trim() : "";
    return {
      ok: true,
      emailDisponivel: resposta.email_disponivel,
      cnpjDisponivel: resposta.cnpj_disponivel,
      cnpjSituacao: situacao,
      razaoSocialReceita: razaoSocial || null,
    };
  } catch (erro) {
    if (erro instanceof ErroBackend && erro.status === 422) {
      const campos = erro.campos.map((campo) => CAMPO_DO_FORMULARIO[campo]).filter(Boolean);
      if (campos.length > 0) return { ok: false, erro: "invalido", campos };
    }
    return { ok: false, erro: "indisponivel" };
  }
}

export type ResultadoRecuperacao =
  | { ok: true }
  | { ok: false; erro: "indisponivel" | "muitas_tentativas" | "falha" };

/**
 * "Esqueci a senha" (`POST /senha/recuperar`, #66). O backend responde igual
 * para e-mail com e sem conta, de propósito: a tela também não distingue. O
 * 503 é o envio de e-mail desligado no servidor, igual para qualquer e-mail.
 */
export async function pedirRecuperacaoSenha(email: string): Promise<ResultadoRecuperacao> {
  try {
    await chamarBackend("/senha/recuperar", {
      method: "POST",
      corpo: { email: email.trim().toLowerCase() },
      publica: true,
    });
  } catch (erro) {
    if (erro instanceof ErroBackend && erro.status === 503) return { ok: false, erro: "indisponivel" };
    if (erro instanceof ErroBackend && erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
  return { ok: true };
}

export type ResultadoRedefinicao =
  | { ok: true }
  | { ok: false; erro: "link_invalido" | "senha_invalida" | "muitas_tentativas" | "falha" };

/**
 * A senha nova a partir do link do e-mail (`POST /senha/redefinir`, #66). Não
 * abre sessão: quem redefiniu entra pelo login, com a senha que acabou de criar.
 * O 400 junta link expirado, já usado e inexistente — o backend não diz qual.
 */
export async function redefinirSenha(token: string, senhaNova: string): Promise<ResultadoRedefinicao> {
  try {
    await chamarBackend("/senha/redefinir", {
      method: "POST",
      corpo: { token, senha_nova: senhaNova },
      publica: true,
    });
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 422 && erro.campos.includes("senha_nova")) return { ok: false, erro: "senha_invalida" };
    if (erro.status === 400 || erro.status === 422) return { ok: false, erro: "link_invalido" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
  return { ok: true };
}

export type ResultadoConsultaConvite =
  | { ok: true; convite: ConsultaConvite }
  | { ok: false; erro: "convite_invalido" | "muitas_tentativas" | "falha" };

/**
 * Quem está convidando e para onde (`POST /convites/consultar`, backend #69), sem
 * login e sem gastar o convite. O token vai no corpo, nunca no endereço. O 400 junta
 * convite inexistente, vencido, usado e cancelado: o backend não diz qual.
 */
export async function consultarConvite(token: string): Promise<ResultadoConsultaConvite> {
  try {
    const convite = await chamarBackend<ConsultaConviteAPI>("/convites/consultar", {
      method: "POST",
      corpo: { token },
      publica: true,
    });
    return { ok: true, convite: adaptarConsultaConvite(convite) };
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 400 || erro.status === 422) return { ok: false, erro: "convite_invalido" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
}

export type ResultadoAceite =
  /** `entrou: false` é conta criada com a sessão que não abriu: falta só entrar. */
  | { ok: true; entrou: boolean }
  | { ok: false; erro: "convite_invalido" | "email_cadastrado" | "senha_invalida" | "muitas_tentativas" | "falha" };

/**
 * Cria a conta pelo convite (`POST /convites/aceitar`), na empresa de quem convidou e
 * com o e-mail do convite, e já entra com a senha nova, como o cadastro faz. O e-mail
 * vem da consulta: o backend não aceita outro. Token vazio é a volta do Google com recusa,
 * quando o token só existe no cookie do convite.
 */
export async function aceitarConvite(token: string, email: string, nome: string, senha: string): Promise<ResultadoAceite> {
  const pote = await cookies();
  const doCookie = !token;
  const tokenDoConvite = token || pote.get(COOKIE_CONVITE_GOOGLE)?.value;
  if (!tokenDoConvite) return { ok: false, erro: "convite_invalido" };
  let usuario: UsuarioAPI;
  try {
    usuario = await chamarBackend<UsuarioAPI>("/convites/aceitar", {
      method: "POST",
      corpo: { token: tokenDoConvite, nome, senha },
      publica: true,
    });
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 400) return { ok: false, erro: "convite_invalido" };
    if (erro.status === 409) return { ok: false, erro: "email_cadastrado" };
    if (erro.status === 422 && erro.campos.includes("senha")) return { ok: false, erro: "senha_invalida" };
    if (erro.status === 422) return { ok: false, erro: "convite_invalido" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
  if (doCookie) pote.delete(COOKIE_CONVITE_GOOGLE);
  // o e-mail da conta é o do convite, que o backend devolve; o do navegador só mostra na tela
  return { ok: true, entrou: (await entrar(usuario.email || email, senha, true)).ok };
}

/**
 * "Aceitar com Google": guarda o token do convite num cookie httpOnly e leva ao Google;
 * na volta, o `aoVoltarDoGoogle` aceita o convite. Token vazio é tentar de novo depois de
 * uma recusa: o cookie da primeira ida continua lá. Como o `entrarComGoogle`, só volta
 * daqui quando não há como ir.
 */
export async function aceitarConviteComGoogle(token: string): Promise<false> {
  if (!process.env.AUTH_GOOGLE_ID) return false;
  const pote = await cookies();
  if (token) {
    pote.set(COOKIE_CONVITE_GOOGLE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VALIDADE_ID_TOKEN_SEGUNDOS,
    });
  } else if (!pote.get(COOKIE_CONVITE_GOOGLE)) {
    return false;
  }
  await signIn("google", { redirectTo: "/visao-geral" });
  return false;
}

/**
 * O convite do cookie, na volta do Google com recusa: o servidor consulta, para o token
 * nunca chegar ao navegador. Roda no render da página, onde o Next não deixa apagar cookie:
 * um convite que não vale mais fica no cookie até a 1 hora dele, e o próximo login pelo
 * Google (`entrarComGoogle`) o apaga antes de sair.
 */
export async function conviteDoCookie(): Promise<ConsultaConvite | null> {
  const token = (await cookies()).get(COOKIE_CONVITE_GOOGLE)?.value;
  if (!token) return null;
  const resposta = await consultarConvite(token);
  return resposta.ok ? resposta.convite : null;
}

/** "Sair e continuar" na página do convite: encerra a sessão de outra conta sem sair da página. */
export async function sairParaAceitarConvite(): Promise<void> {
  await signOut({ redirect: false });
}

export async function sair(): Promise<void> {
  // o id_token do cadastro pelo Google e o convite pela metade não ficam para quem usar o navegador depois
  const pote = await cookies();
  pote.delete(COOKIE_CADASTRO_GOOGLE);
  pote.delete(COOKIE_CONVITE_GOOGLE);
  await signOut({ redirectTo: "/login" });
}

/** O que o app guarda da conta logada, lido uma vez por carregamento do layout. */
export type ContaDaSessao = {
  /** A razão social, para o cabeçalho e o menu. Vazia quando o backend não respondeu. */
  empresa: string;
  /** Falso na conta que só entra pelo Google: para ela, `POST /me/senha` responde 409. */
  temSenha: boolean;
  /**
   * As empresas da conta, para o seletor e para conferir a empresa da URL (backend #133), na ordem do
   * backend (razão social). Vazia quando o `GET /me` não manda o campo (backend anterior) ou falhou.
   */
  empresas: EmpresaDaConta[];
  /** admin, gestor ou analista (backend #133). Sem `papel`, lê o `administrador` antigo; sem nenhum, admin, como na conta única. */
  papel: Papel;
  /** O que a pessoa dispensou no primeiro uso; null quando o `GET /me` ainda não manda o campo. */
  preferencias: Preferencias | null;
  /** O plano e o teste de 14 dias; null quando o `GET /me` ainda não manda `situacao`: nada bloqueia. */
  assinatura: Assinatura | null;
  /** Quanto do plano a conta já usa (empresas e pessoas); null quando o `GET /me` ainda não manda `limites`: nada é mostrado. */
  limites: LimitesDaConta | null;
  /** Só quando o `GET /me` falhou: `empresas` vazia então não quer dizer "backend anterior", e ninguém deve adivinhar a empresa. */
  indisponivel?: true;
};

type PreferenciasAPI = { tutoriais_dispensados?: unknown; roteiro_dispensado?: unknown };

function adaptarPreferencias(bruto: PreferenciasAPI | null | undefined): Preferencias | null {
  if (!bruto || typeof bruto !== "object") return null;
  const telas = Array.isArray(bruto.tutoriais_dispensados) ? bruto.tutoriais_dispensados.filter(ehTela) : [];
  return { tutoriaisDispensados: telas, roteiroDispensado: bruto.roteiro_dispensado === true };
}

/** As empresas do `GET /me`; o item sem `id` de texto não serve para a URL e é ignorado. */
function adaptarEmpresas(bruto: { id?: unknown; razao_social?: unknown; cnpj?: unknown }[] | undefined): EmpresaDaConta[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((empresa) =>
    typeof empresa?.id === "string" && empresa.id
      ? [
          {
            id: empresa.id,
            razaoSocial: typeof empresa.razao_social === "string" ? empresa.razao_social.trim() : "",
            cnpj: typeof empresa.cnpj === "string" ? empresa.cnpj : "",
          },
        ]
      : [],
  );
}

/**
 * A conta logada, de `GET /me` (backend #81), que o `/login` não cobre: ele devolve só
 * o usuário. O papel vem em `papel` (backend #133); o `administrador` é obsoleto. Limite de 60 chamadas por
 * minuto por usuário, por isso só o layout chama.
 *
 * Se a rota falhar, a empresa fica vazia e as telas a escondem, melhor que mostrar o
 * nome de outra; a troca de senha fica à mostra, e o backend diz o motivo se recusar.
 */
export async function contaDaSessao(): Promise<ContaDaSessao> {
  try {
    const eu = await chamarBackend<
      UsuarioAPI & {
        razao_social: string;
        metodos_login: string[];
        papel?: unknown;
        empresas?: { id?: unknown; razao_social?: unknown; cnpj?: unknown }[];
        administrador?: boolean;
        preferencias?: PreferenciasAPI;
        situacao?: unknown;
        plano?: unknown;
        teste_termina_em?: unknown;
        limites?: unknown;
      }
    >("/me");
    return {
      empresa: eu.razao_social?.trim() ?? "",
      temSenha: eu.metodos_login?.includes("senha") ?? true,
      papel: lerPapel(eu),
      empresas: adaptarEmpresas(eu.empresas),
      preferencias: adaptarPreferencias(eu.preferencias),
      assinatura: adaptarAssinatura(eu),
      limites: adaptarLimites(eu.limites),
    };
  } catch {
    return { empresa: "", temSenha: true, papel: "admin", empresas: [], preferencias: null, assinatura: null, limites: null, indisponivel: true };
  }
}

/**
 * Guarda as preferências do primeiro uso na conta (`PATCH /me/preferencias`). Falso quando o
 * backend ainda não tem a rota ou não respondeu: o navegador já guardou, a tela não avisa nada.
 */
export async function salvarPreferencias(preferencias: Preferencias): Promise<boolean> {
  // pela naConta: na conta de demonstração, um visitante não esconde o tutorial dos outros
  try {
    const resposta = await naConta(() =>
      chamarBackend("/me/preferencias", {
        method: "PATCH",
        corpo: {
          tutoriais_dispensados: preferencias.tutoriaisDispensados,
          roteiro_dispensado: preferencias.roteiroDispensado,
        },
      }),
    );
    return resposta.ok;
  } catch {
    return false;
  }
}

export type ResultadoConta = { ok: true } | { ok: false; erro: string };

const FALHA_CONTA = "Não foi possível salvar agora. Tente de novo em instantes.";

/**
 * Trocar senha, trocar e-mail e excluir a conta: as rotas `/me/*` das issues
 * #66 e #68 do backend. O 404 é a rota que ainda não subiu.
 */
function mensagemDaConta(erro: unknown): string {
  if (!(erro instanceof ErroBackend)) return FALHA_CONTA;
  if (erro.status === 404 || erro.status === 405) {
    return "Ainda não disponível: o servidor do Ledgr ainda não tem esta função.";
  }
  // "Senha atual incorreta." (400) e "E-mail já cadastrado." ou conta do Google
  // (409): o texto do backend é o contrato da #66, feito para a tela.
  if (erro.status === 400 || erro.status === 409) return erro.detalhe;
  if (erro.status === 422 && erro.campos.includes("email_novo")) return "Confira o novo e-mail.";
  if (erro.status === 422 && erro.campos.includes("senha_nova")) {
    return "A senha nova precisa ter de 8 a 72 caracteres.";
  }
  // "O e-mail novo é igual ao atual." (#149): um 422 com texto, não a lista do FastAPI
  if (erro.status === 422 && erro.campos.length === 0 && erro.detalhe) return erro.detalhe;
  if (erro.status === 429) {
    // a troca de e-mail aceita 3 pedidos por hora: o Retry-After pode passar de um minuto
    const minutos = Math.ceil((erro.segundosParaTentar ?? 0) / 60);
    if (minutos > 1) return `Muitas tentativas. Tente de novo em ${minutos} minutos.`;
    return "Muitas tentativas. Espere um minuto e tente de novo.";
  }
  if (erro.status === 503) return "O envio de e-mails está fora do ar agora. Tente de novo mais tarde.";
  return FALHA_CONTA;
}

/**
 * A chamada à conta de quem está logado. A conta de demonstração é de todo
 * mundo que clica em "Entrar com Google": trocar a senha dela ou apagá-la
 * tiraria a demonstração do ar, então a recusa é aqui, não só na tela.
 */
async function naConta(
  chamada: () => Promise<unknown>,
): Promise<{ ok: true; email: string } | { ok: false; erro: string }> {
  const email = await emailDaSessao();
  if (!email) redirect("/login");
  if (ehContaDeDemonstracao(email)) return { ok: false, erro: RECUSA_DEMONSTRACAO };
  try {
    await chamada();
    return { ok: true, email };
  } catch (erro) {
    // aqui 401 é sessão que acabou: senha atual errada volta 400 (#66)
    if (erro instanceof ErroBackend && erro.status === 401) redirect("/login");
    return { ok: false, erro: mensagemDaConta(erro) };
  }
}

// Depois de trocar, a sessão é refeita com o que a pessoa acabou de digitar
// (#66): o token leva o e-mail, e quando a #75 revogar os tokens antigos, o
// atual deixaria de valer. ponytail: refeita sem "manter sessão", porque o
// servidor não sabe o que a pessoa escolheu no login; errar para o lado que
// termina com o navegador é o que não deixa sessão aberta sem ela querer.

/** Sem a sessão nova, sai: a troca já valeu no backend, e o login de novo é o caminho seguro. */
async function refazerSessao(email: string, senha: string): Promise<void> {
  if (!(await entrar(email, senha, false)).ok) await signOut({ redirectTo: "/login" });
}

export async function trocarSenha(senhaAtual: string, senhaNova: string): Promise<ResultadoConta> {
  const conta = await naConta(() =>
    chamarBackend("/me/senha", {
      method: "POST",
      corpo: { senha_atual: senhaAtual, senha_nova: senhaNova },
    }),
  );
  if (!conta.ok) return conta;
  await refazerSessao(conta.email, senhaNova);
  return { ok: true };
}

export type ResultadoTrocaEmail = { ok: true; emailNovo: string; expiraEm: string } | { ok: false; erro: string };

/**
 * Pede a troca do e-mail (`POST /me/email`, backend #149): o 202 só manda um link ao e-mail novo, e
 * o da conta continua o mesmo até ele ser aberto em `/confirmar-email`. Por isso a sessão fica como
 * está; ela cai quando a troca for confirmada.
 */
export async function trocarEmail(emailNovo: string, senhaAtual: string): Promise<ResultadoTrocaEmail> {
  const email = emailNovo.trim().toLowerCase();
  let pedido: { email_novo?: string; expira_em?: string } | undefined;
  const conta = await naConta(async () => {
    pedido = await chamarBackend<{ email_novo: string; expira_em: string }>("/me/email", {
      method: "POST",
      corpo: { email_novo: email, senha_atual: senhaAtual },
    });
  });
  if (!conta.ok) return conta;
  return { ok: true, emailNovo: pedido?.email_novo ?? email, expiraEm: pedido?.expira_em ?? "" };
}

export type ResultadoConfirmacaoEmail =
  | { ok: true; email: string }
  | { ok: false; erro: "link_invalido" | "email_em_uso" | "muitas_tentativas" | "falha" };

/**
 * Confirma a troca de e-mail pelo link (`POST /me/email/confirmar`, backend #149), sem login. O
 * backend encerra todas as sessões da conta no sucesso; a deste navegador sai junto, para o login
 * seguinte não esbarrar num token que já não vale. O 409 (e-mail tomado nesse meio-tempo) gasta o link.
 */
export async function confirmarEmail(token: string): Promise<ResultadoConfirmacaoEmail> {
  let email: string;
  try {
    ({ email } = await chamarBackend<{ email: string }>("/me/email/confirmar", {
      method: "POST",
      corpo: { token },
      publica: true,
    }));
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 400 || erro.status === 422) return { ok: false, erro: "link_invalido" };
    if (erro.status === 409) return { ok: false, erro: "email_em_uso" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
  await signOut({ redirect: false });
  return { ok: true, email };
}

/**
 * Desativa a conta de quem está logado (`DELETE /me`, backend #68): tira o acesso, libera o e-mail
 * e encerra as sessões. Os dados da empresa ficam; a exclusão deles é a pedido, por e-mail. Pede a
 * senha: com um token roubado, sem ela, dava para tirar a pessoa da conta. A conta só do Google não
 * tem senha (null): o backend confere o login recente e, se for antigo, responde 409 com o texto
 * que pede para entrar de novo pelo Google. O administrador com outras pessoas na equipe também
 * recebe 409, pedindo para removê-las antes.
 */
export async function desativarConta(senhaAtual: string | null): Promise<ResultadoConta> {
  const conta = await naConta(() =>
    chamarBackend("/me", { method: "DELETE", ...(senhaAtual === null ? {} : { corpo: { senha_atual: senhaAtual } }) }),
  );
  if (!conta.ok) return conta;
  await signOut({ redirectTo: "/" });
  return { ok: true };
}

/** Começa o teste de 14 dias no plano escolhido (`POST /empresa/plano`, spec 2026-10-15-primeiro-uso). */
export async function escolherPlano(plano: PlanoId): Promise<{ ok: true } | { ok: false; erro: string }> {
  // Server Action é endpoint público: só os três ids chegam ao backend
  if (!["essencial", "padrao", "avancado"].includes(plano)) return { ok: false, erro: FALHA_CONTA };
  // pela naConta: a conta de demonstração não escolhe plano
  const resposta = await naConta(() => chamarBackend("/empresa/plano", { method: "POST", corpo: { plano } }));
  return resposta.ok ? { ok: true } : resposta;
}
