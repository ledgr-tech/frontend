// Passos do cadastro. O de acesso foi criado para esta tela (o Claude Design não pede senha);
// os três seguintes vêm do onboarding do Claude Design (título, texto, campos, exemplos, botão, dica e mascote),
// com ajustes de texto onde o original não batia com os campos da tela.
// Decisões em docs/superpowers/specs/2026-09-15-tela-cadastro-design.md

export const SENHA_MINIMA = 8;

export type CampoCadastro = {
  id: string;
  /** nome do campo, no rótulo flutuante */
  rotulo: string;
  /** exemplo de preenchimento, visível com o campo em foco */
  exemplo?: string;
  tipo: "text" | "email" | "password";
  autoComplete: string;
  inputMode?: "text" | "numeric" | "email";
  autoCapitalize?: string;
  maxLength?: number;
  mensagemVazio: string;
  /** máscara aplicada enquanto a pessoa digita */
  formatar?: (valor: string) => string;
  /** checagem extra depois de o campo estar preenchido; devolve a mensagem de erro */
  validar?: (valor: string) => string | undefined;
};

export type MascotePasso = {
  src: string;
  largura: number;
  altura: number;
};

export type PassoCadastro = {
  id: "acesso" | "empresa" | "banco" | "sistema";
  rotuloEtapa: string;
  eyebrow: string;
  titulo: string;
  texto: string;
  campos: CampoCadastro[];
  botao: string;
  mascote: MascotePasso;
  dicaTitulo?: string;
  dicaTexto?: string;
};

// CNPJ alfanumérico (Receita Federal, a partir de julho/2026): as 12 primeiras posições aceitam letras
// e números; os 2 dígitos verificadores continuam numéricos. Os CNPJs só com números seguem valendo.
function caracteresCnpj(valor: string): string {
  const limpo = valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return limpo.slice(0, 12) + limpo.slice(12).replace(/\D/g, "").slice(0, 2);
}

/** Máscara 00.000.000/0000-00; a pontuação só entra quando já existe o caractere seguinte, para o apagar funcionar. */
export function formatarCnpj(valor: string): string {
  const c = caracteresCnpj(valor);
  let formatado = c.slice(0, 2);
  if (c.length > 2) formatado += `.${c.slice(2, 5)}`;
  if (c.length > 5) formatado += `.${c.slice(5, 8)}`;
  if (c.length > 8) formatado += `/${c.slice(8, 12)}`;
  if (c.length > 12) formatado += `-${c.slice(12, 14)}`;
  return formatado;
}

// só o tamanho e o formato: o cálculo do dígito verificador fica para depois
function validarCnpj(valor: string): string | undefined {
  return /^[A-Z0-9]{12}\d{2}$/.test(caracteresCnpj(valor)) ? undefined : "O CNPJ tem 14 caracteres. Confira o número.";
}

export const PASSOS: PassoCadastro[] = [
  {
    id: "acesso",
    rotuloEtapa: "Acesso",
    eyebrow: "Antes de começar",
    titulo: "Crie seu acesso.",
    texto: "Use seu e-mail de trabalho. É com ele e com esta senha que você entra no Ledgr para acompanhar as conciliações.",
    campos: [
      { id: "nome", rotulo: "Nome completo", tipo: "text", autoComplete: "name", autoCapitalize: "words", mensagemVazio: "Informe seu nome." },
      {
        id: "email",
        rotulo: "E-mail",
        exemplo: "nome@empresa.com.br",
        tipo: "email",
        autoComplete: "email",
        inputMode: "email",
        mensagemVazio: "Informe seu e-mail.",
      },
      {
        id: "senha",
        rotulo: "Senha",
        tipo: "password",
        autoComplete: "new-password",
        mensagemVazio: `Crie uma senha com pelo menos ${SENHA_MINIMA} caracteres.`,
      },
    ],
    botao: "Continuar",
    mascote: { src: "/mascotes/mascote-apresenta.png", largura: 824, altura: 720 },
  },
  {
    id: "empresa",
    rotuloEtapa: "Empresa",
    eyebrow: "Passo I de III",
    titulo: "Vamos cadastrar a empresa.",
    texto:
      "Cada empresa tem sua própria conciliação, seu histórico e seu fechamento. Você pode adicionar outras depois, sem custo de setup.",
    campos: [
      {
        id: "razaoSocial",
        rotulo: "Razão social",
        exemplo: "Padaria Aurora Ltda",
        tipo: "text",
        autoComplete: "organization",
        mensagemVazio: "Informe a razão social.",
      },
      {
        id: "cnpj",
        rotulo: "CNPJ",
        exemplo: "12.345.678/0001-90",
        tipo: "text",
        autoComplete: "off",
        // sem teclado numérico: o CNPJ novo pode ter letras
        autoCapitalize: "characters",
        maxLength: 18,
        mensagemVazio: "Informe o CNPJ.",
        formatar: formatarCnpj,
        validar: validarCnpj,
      },
    ],
    botao: "Continuar",
    mascote: { src: "/mascotes/mascote-neutro.png", largura: 881, altura: 900 },
    dicaTitulo: "Uma empresa por conciliação",
    dicaTexto: "Misturar CNPJs no mesmo extrato é a causa mais comum de divergência falsa.",
  },
  {
    id: "banco",
    rotuloEtapa: "Banco",
    eyebrow: "Passo II de III",
    titulo: "Qual banco você vai conciliar?",
    texto: "Informe o banco e a conta de onde sai o extrato. É esse extrato que define a verdade da conciliação.",
    campos: [
      {
        id: "banco",
        rotulo: "Banco e agência",
        exemplo: "Banco do Brasil · ag. 1234",
        tipo: "text",
        autoComplete: "off",
        mensagemVazio: "Informe o banco e a agência.",
      },
      // sem teclado numérico: o dígito da conta pode vir com hífen ou ser X
      {
        id: "conta",
        rotulo: "Conta corrente",
        exemplo: "45678-9",
        tipo: "text",
        autoComplete: "off",
        mensagemVazio: "Informe o número da conta corrente.",
      },
    ],
    botao: "Continuar",
    mascote: { src: "/mascotes/mascote-explicando.png", largura: 1000, altura: 1000 },
    dicaTitulo: "OFX é melhor que CSV",
    dicaTexto: "O OFX já traz data, valor e identificador de cada lançamento, então mais lançamentos casam automaticamente.",
  },
  {
    id: "sistema",
    rotuloEtapa: "Sistema de gestão",
    eyebrow: "Passo III de III",
    titulo: "E o sistema de gestão?",
    texto: "Diga de qual sistema sai o segundo extrato. Se o seu ERP não for um dos compatíveis, o CSV exportado dele também funciona.",
    campos: [
      {
        id: "sistema",
        rotulo: "Sistema de gestão",
        exemplo: "Omie, Bling, Tiny, outro…",
        tipo: "text",
        autoComplete: "off",
        mensagemVazio: "Informe o sistema de gestão.",
      },
      {
        id: "emailResponsavel",
        rotulo: "E-mail do responsável",
        exemplo: "financeiro@aurora.com.br",
        tipo: "email",
        autoComplete: "email",
        inputMode: "email",
        mensagemVazio: "Informe o e-mail do responsável.",
      },
    ],
    botao: "Concluir e subir extratos",
    mascote: { src: "/mascotes/mascote-comemorando.png", largura: 1000, altura: 1000 },
    dicaTitulo: "O sistema é o que se ajusta",
    dicaTexto: "Toda divergência é apontada como “o sistema diverge do banco”, nunca o contrário.",
  },
];
