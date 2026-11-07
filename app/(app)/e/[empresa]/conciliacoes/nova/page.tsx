"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useRoteador } from "@/lib/roteador";
import { useEmpresaAtiva, useEmpresasDaConta } from "@/lib/empresa-ativa";
import { ArrowRight, Check, Link2, Scale, ShieldCheck } from "lucide-react";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { abrirConfiguracoes, TOLERANCIA_SALVA } from "@/lib/eventos";
import { comEmpresa, ehUuid } from "@/lib/rotas";
import { extratoGrandeDemais, TAMANHO_MAXIMO_UPLOAD_BYTES } from "@/lib/limite-de-upload";
import { carregarRegras, conciliar, type Falha, type SituacaoExtrato } from "../acoes";
import {
  aguardarProcessamento,
  conferirCsv,
  ERRO_SEM_RESPOSTA,
  motivoDaRecusa,
  DETALHE,
  RECADO,
  subir,
  type Etapa,
  type Origem,
  type Pendente,
} from "../envio";
import { ImportacaoInterrompida } from "./importacao-interrompida";
import { LinhasNaoLidas } from "../linhas-nao-lidas";
import { PlanosBloqueados } from "./planos-bloqueados";
import { useAssinatura } from "../../conta";
import { bloqueiaConciliacao, type PrecoDoPlano } from "@/lib/assinatura";
import { carregarPrecos } from "../../assinatura/acoes";
import { Cabecalho } from "../../cabecalho";
import { IconeOrigem } from "../../icone-origem";
import { Guia, type Passo } from "./guia";

export default function NovaConciliacaoPage() {
  const router = useRoteador();
  // a importação via IA confirmada leva para cá com o id do extrato do sistema já criado (?sistema=):
  // a folha do sistema vem pronta e só falta o banco
  const idDaIa = useSearchParams()?.get("sistema") ?? null;
  const sistemaDaIa = idDaIa !== null && ehUuid(idDaIa) ? idDaIa : null;
  const [arquivoBanco, setArquivoBanco] = useState<File | null>(null);
  const [arquivoSistema, setArquivoSistema] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const assinatura = useAssinatura();
  const empresaAtiva = useEmpresaAtiva();
  const empresas = useEmpresasDaConta();
  // o backend recusou a conciliação pelo plano (402): o texto dele vai no lugar do envio
  const [recusa, setRecusa] = useState<string | null>(null);
  const [precos, setPrecos] = useState<PrecoDoPlano[] | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  // os dois extratos subiram, mas algum veio lido em parte: a conciliação espera a pessoa decidir
  const [parcial, setParcial] = useState<{ banco: string; sistema: string; lidosEmParte: SituacaoExtrato[] } | null>(
    null,
  );
  // a tolerância que esta conciliação vai usar; sem resposta (404, erro), a linha não aparece
  const [toleranciaDias, setToleranciaDias] = useState<number | null>(null);
  // depois do primeiro envio, as folhas só voltam quando o envio falha: aí elas sobem com fade, em vez
  // de trocar de supetão com o palco (na chegada à tela, quem anima é a troca de telas)
  const [jaEnviou, setJaEnviou] = useState(false);
  // para o laço de consulta se a pessoa sair da tela no meio do processamento
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    void carregarRegras()
      .then((regras) => {
        if (vivo.current && regras.ok) setToleranciaDias(regras.dados.toleranciaDias);
      })
      .catch(() => {});
    // "Mudar" abre Configurações por cima desta tela: o que se salva lá aparece aqui
    const aoSalvar = (evento: Event) => setToleranciaDias((evento as CustomEvent<number>).detail);
    window.addEventListener(TOLERANCIA_SALVA, aoSalvar);
    return () => {
      vivo.current = false;
      window.removeEventListener(TOLERANCIA_SALVA, aoSalvar);
    };
  }, []);

  function escolher(origem: Origem, arquivo: File) {
    setErro(null);
    if (origem === "banco") setArquivoBanco(arquivo);
    else setArquivoSistema(arquivo);
  }

  function falhar(falha: Falha) {
    // 401 é sessão expirada: de volta pro login, em vez de um erro na tela
    if (falha.status === 401) {
      router.push("/login");
      return;
    }
    setEtapa("ocioso");
    setErro(falha.erro);
  }

  /**
   * O CSV passa pelas regras do backend antes de subir. Devolve true se pode
   * subir como está; senão abre a importação interrompida ou mostra o erro.
   */
  async function conferir(arquivo: File, origem: Origem): Promise<boolean> {
    const conferido = await conferirCsv(arquivo, origem);
    if (conferido.pronto) return true;
    if ("erro" in conferido) setErro(conferido.erro);
    else setPendente(conferido.pendente);
    return false;
  }

  async function conciliarExtratos(banco = arquivoBanco, sistema = arquivoSistema) {
    if (!banco || (!sistema && !sistemaDaIa)) return;

    const grande = [banco, sistema].find((arquivo) => arquivo && arquivo.size > TAMANHO_MAXIMO_UPLOAD_BYTES);
    if (grande) {
      // sem isso, o arquivo inteiro sobe só pra requisição ser recusada no caminho
      setErro(extratoGrandeDemais(grande.name));
      return;
    }

    setErro(null);
    setJaEnviou(true);
    setEtapa("conferindo");

    try {
      // nada sobe antes de os dois estarem prontos: extrato órfão no backend não tem volta
      if (!(await conferir(banco, "banco")) || (sistema && !(await conferir(sistema, "sistema")))) {
        setEtapa("ocioso");
        return;
      }
      setEtapa("enviando");
      await enviarEConciliar(banco, sistema);
    } catch {
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    }
  }

  /** Mapeamento confirmado: troca o arquivo pelo reescrito e continua de onde parou. */
  function retomar(reescrito: File) {
    if (!pendente) return;
    const banco = pendente.origem === "banco" ? reescrito : arquivoBanco;
    const sistema = pendente.origem === "sistema" ? reescrito : arquivoSistema;
    setArquivoBanco(banco);
    setArquivoSistema(sistema);
    setPendente(null);
    void conciliarExtratos(banco, sistema);
  }

  function subirOutro() {
    if (!pendente) return;
    if (pendente.origem === "banco") setArquivoBanco(null);
    else setArquivoSistema(null);
    setPendente(null);
  }

  async function enviarEConciliar(arquivoBanco: File, arquivoSistema: File | null) {
    const banco = await subir(arquivoBanco, "banco");
    if (!banco.ok) return falhar(banco);
    // o sistema da importação via IA já é um extrato lido: só o banco sobe e espera
    const sistema = arquivoSistema
      ? await subir(arquivoSistema, "sistema")
      : { ok: true as const, dados: { extratoId: sistemaDaIa ?? "" } };
    if (!sistema.ok) return falhar(sistema);

    setEtapa("processando");
    const situacoes = await Promise.all([
      aguardarProcessamento(banco.dados.extratoId, () => vivo.current),
      ...(arquivoSistema ? [aguardarProcessamento(sistema.dados.extratoId, () => vivo.current)] : []),
    ]);

    const lidosEmParte: SituacaoExtrato[] = [];
    for (const situacao of situacoes) {
      if (situacao === null) {
        setEtapa("ocioso");
        setErro("O processamento demorou mais que o esperado. Tente de novo em instantes.");
        return;
      }
      if ("ok" in situacao) return falhar(situacao);
      if (situacao.status === "erro") {
        setEtapa("ocioso");
        setErro(motivoDaRecusa(situacao));
        return;
      }
      if (situacao.status === "concluido_com_erros") lidosEmParte.push(situacao);
    }
    if (lidosEmParte.length > 0) {
      // conciliar com linhas de fora não tem volta do lado do banco (não há nova versão dele nem rota
      // para apagar a conciliação): a conciliação só nasce depois da decisão, e continuar reaproveita os uploads
      setParcial({ banco: banco.dados.extratoId, sistema: sistema.dados.extratoId, lidosEmParte });
      setEtapa("ocioso");
      return;
    }
    await concluir(banco.dados.extratoId, sistema.dados.extratoId);
  }

  async function concluir(bancoId: string, sistemaId: string) {
    setEtapa("conciliando");
    const resultado = await conciliar(bancoId, sistemaId);
    if (!resultado.ok && resultado.status === 402) {
      setEtapa("ocioso");
      setRecusa(resultado.erro);
      return;
    }
    if (!resultado.ok) return falhar(resultado);

    // A listagem do resultado parte do extrato do banco (o do sistema seria
    // ambíguo, porque pode ter sido conciliado com vários extratos de banco), e
    // o do sistema vai junto para filtrar só as linhas deste par.
    router.push(caminhoDaConciliacao(bancoId, sistemaId));
  }

  async function continuarComLinhasValidas() {
    if (!parcial) return;
    setErro(null);
    try {
      await concluir(parcial.banco, parcial.sistema);
    } catch {
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    }
  }

  function voltarParaCorrigir() {
    if (!parcial) return;
    // o arquivo lido em parte sai da folha, à espera do corrigido; o outro fica.
    // ponytail: a próxima tentativa sobe os dois de novo, e o que veio inteiro vira uma cópia em Extratos;
    // o #308 descarta os dois ao voltar quando o backend tiver a rota (backend#185)
    for (const { origem } of parcial.lidosEmParte) {
      if (origem === "banco") setArquivoBanco(null);
      else setArquivoSistema(null);
    }
    setParcial(null);
    setErro(null);
  }

  const sistemaPronto = arquivoSistema !== null || sistemaDaIa !== null;
  const podeConciliar = arquivoBanco !== null && sistemaPronto;
  const ocupado = etapa !== "ocioso";
  const prontos = (arquivoBanco ? 1 : 0) + (sistemaPronto ? 1 : 0);
  const falta =
    !arquivoBanco && !sistemaPronto
      ? "Envie os dois extratos para conciliar."
      : !arquivoBanco
        ? "Falta o extrato do banco."
        : "Falta o extrato do sistema de gestão.";

  // teste acabado ou assinatura encerrada (backend #180), ou o 402 do backend: os planos no lugar do envio
  const bloqueada = (assinatura !== null && bloqueiaConciliacao(assinatura.situacao)) || recusa !== null;

  // os preços da Stripe, os mesmos da Assinatura, só quando a tela bloqueia
  useEffect(() => {
    if (!bloqueada) return;
    let viva = true;
    void carregarPrecos()
      .then((lidos) => viva && setPrecos(lidos))
      .catch(() => {});
    return () => {
      viva = false;
    };
  }, [bloqueada]);

  if (pendente) {
    return (
      <div style={{ padding: "36px 0 64px" }}>
        <ImportacaoInterrompida
          nome={pendente.arquivo.name}
          origem={pendente.origem}
          analise={pendente.analise}
          onPronto={retomar}
          onOutroArquivo={subirOutro}
        />
      </div>
    );
  }

  if (bloqueada) {
    return (
      <div className="nova-tela">
        <Cabecalho titulo="Nova conciliação" contexto={[]} />
        <div className="nova-corpo">
          <PlanosBloqueados motivo={recusa ?? undefined} situacao={assinatura?.situacao} precos={precos} />
        </div>
      </div>
    );
  }

  // continuar troca a decisão pelo palco; se a conciliação falha, ela volta com o motivo, sem reenviar
  if (parcial && !ocupado) {
    return (
      <div style={{ padding: "36px 0 64px" }}>
        <div className="importacao">
          <div>
            <h1 className="importacao-titulo">Nem todas as linhas foram lidas</h1>
            <p className="importacao-texto">
              A conciliação usará somente as linhas válidas. Volte para corrigir o arquivo ou confirme que deseja
              continuar sem as linhas rejeitadas. Se voltar ou sair desta tela, os dois arquivos enviados ficam em
              Extratos, sem conciliação.
            </p>
          </div>
          {parcial.lidosEmParte.map(({ origem, erros }) => (
            <LinhasNaoLidas key={origem} origem={origem} erros={erros} />
          ))}
          {erro && (
            <p role="alert" className="selo selo-risco nova-versao-erro">
              {erro}
            </p>
          )}
          <div className="importacao-acoes">
            {/* o foco vai para a saída que não concilia: um Enter a mais não concilia sem a pessoa ler */}
            <button type="button" className="btn btn-secondary" autoFocus onClick={voltarParaCorrigir}>
              Voltar para corrigir
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void continuarComLinhasValidas()}>
              Continuar com linhas válidas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nova-tela">
      {/* o mês só se sabe depois de ler as datas dos extratos: a linha diz de onde ele vai sair */}
      <Cabecalho titulo="Nova conciliação" contexto={["o mês sai das datas do extrato"]} />

      {/* em cima de tudo, perto de onde a pessoa acabou de soltar ou clicar */}
      {erro && (
        <p role="alert" className="selo selo-risco nova-erro">
          {erro}
        </p>
      )}

      {ocupado && arquivoBanco && sistemaPronto ? (
        <Palco banco={arquivoBanco.name} sistema={arquivoSistema?.name ?? "Importação via IA"} etapa={etapa} />
      ) : (
        <div className={jaEnviou ? "nova-corpo conc-mesa nova-volta" : "nova-corpo conc-mesa"}>
          <div className="nova-coluna">
            {/* num escritório com várias empresas, quem concilia confere para qual está enviando */}
            {empresas.length > 1 && empresaAtiva && (
              <p className="nova-empresa">
                Conciliando para <strong>{empresaAtiva.razaoSocial}</strong>
              </p>
            )}
            {/* as folhas de Conciliações, em pé, são as áreas de soltar: o banco na frente, o sistema
                atrás, e o elo no canto onde se cruzam acende quando entraram as duas */}
            <div className="nova-folhas" data-tutorial="encaixe" data-ligado={podeConciliar ? "" : undefined}>
              <FolhaDeExtrato
                origem="banco"
                titulo="Extrato do banco"
                dica="Arquivo OFX ou CSV exportado do internet banking"
                accept=".ofx,.csv"
                formatos="OFX ou CSV"
                arquivo={arquivoBanco}
                onArquivo={(arquivo) => escolher("banco", arquivo)}
                onRecusado={setErro}
              />
              <span className="nova-elo-no" aria-hidden="true">
                <Link2 />
              </span>
              {sistemaDaIa ? (
                // o rascunho da IA já virou extrato ao confirmar: a folha vem pronta e não se troca aqui
                <div className="nova-folha nova-folha-sistema" data-pronto="">
                  <span className="rotulo nova-folha-rotulo">
                    <span className="nova-folha-icone">
                      <Check aria-hidden="true" />
                    </span>
                    Sistema de gestão
                  </span>
                  <strong className="nova-folha-titulo">Importação via IA</strong>
                  <span className="nova-folha-dica">Já confirmado</span>
                </div>
              ) : (
                <FolhaDeExtrato
                  origem="sistema"
                  titulo="Extrato do sistema de gestão"
                  dica="Arquivo CSV exportado do seu sistema de gestão"
                  accept=".csv"
                  formatos="CSV"
                  arquivo={arquivoSistema}
                  onArquivo={(arquivo) => escolher("sistema", arquivo)}
                  onRecusado={setErro}
                />
              )}
            </div>
            {!sistemaDaIa && (
            <section className="nova-ia-card" aria-labelledby="nova-ia-titulo">
              <h3 id="nova-ia-titulo" className="font-titulo">
                Só tem o PDF do relatório?
              </h3>
              <p>
                Use a IA que você já tem, como o ChatGPT ou o Claude, para transformar o PDF no arquivo do
                Ledgr. Você confere as linhas antes de confirmar.
              </p>
              {/* página inteira de propósito: na navegação do cliente, o painel do detalhe da linha
                  (conciliacoes/[id]/@painel/(.)[linha]) intercepta /conciliacoes/nova/ia como a linha "ia"
                  da conciliação "nova" (#260). shortcut: sai quando a importação deixar /conciliacoes/ */}
              <a className="btn btn-secondary" href={comEmpresa(empresaAtiva?.id ?? "", "/conciliacoes/nova/ia")}>
                Importar via IA <ArrowRight aria-hidden="true" />
              </a>
              <Image
                className="nova-ia-mascote"
                src="/mascotes/mascote-lupa.png"
                alt=""
                width={977}
                height={1122}
                sizes="170px"
              />
            </section>
            )}
          </div>

          <aside className="conc-previa" aria-label="Antes de conciliar">
            {/* a empresa já está no cabeçalho (e em "Conciliando para", com mais de uma) */}
            <span className="rotulo">Antes de conciliar</span>
            <h2 className="conc-previa-titulo" aria-live="polite">
              {prontos === 2 ? "Pronta para conciliar" : prontos === 1 ? "Falta um extrato" : "Envie os dois extratos"}
            </h2>
            <div className="extrato-resultado">
              <p className="conc-previa-numero">
                <strong>{prontos} de 2</strong> extratos
              </p>
              <ul className="nova-checklist">
                <li data-feito={arquivoBanco ? "" : undefined}>
                  <span className="nova-checklist-marca" aria-hidden="true">
                    <Check />
                  </span>
                  Banco{arquivoBanco ? ": enviado" : ": falta"}
                </li>
                <li data-feito={sistemaPronto ? "" : undefined}>
                  <span className="nova-checklist-marca" aria-hidden="true">
                    <Check />
                  </span>
                  Sistema de gestão{sistemaPronto ? ": enviado" : ": falta"}
                </li>
              </ul>
            </div>
            {/* o ciclo, dito antes do envio: o Ledgr só lê e confere, quem corrige é a pessoa, no
                próprio sistema, e cada nova versão do extrato do sistema vira uma rodada */}
            <Guia titulo="Como funciona" subtitulo="Três passos, a cada mês" passos={PASSOS} />
            <dl className="conc-previa-dados">
              <dt>Mês</dt>
              <dd className="nova-apagado">Lido das datas do extrato do banco</dd>
              {toleranciaDias !== null && (
                <>
                  <dt>Tolerância de data</dt>
                  <dd>
                    {toleranciaDias === 1 ? "1 dia" : `${toleranciaDias} dias`} ·{" "}
                    <button type="button" className="nova-link" onClick={() => abrirConfiguracoes("conciliacao")}>
                      Mudar
                    </button>
                  </dd>
                </>
              )}
              <dt>Rodada</dt>
              <dd>1, a primeira deste extrato</dd>
            </dl>
            <div className="conc-previa-acoes">
              <button
                type="button"
                className="btn nova-conciliar"
                data-tutorial="conciliar"
                disabled={!podeConciliar}
                aria-describedby={podeConciliar ? undefined : "nova-conciliacao-pendente"}
                onClick={() => void conciliarExtratos()}
              >
                Conciliar extratos
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
            {/* o título do painel já diz o que falta à vista; aqui é o motivo do botão desligado, para
                o leitor de tela */}
            {!podeConciliar && (
              <p id="nova-conciliacao-pendente" className="sr-only">
                {falta}
              </p>
            )}
            <p className="nova-nota">
              <ShieldCheck aria-hidden="true" />
              <span>O Ledgr não altera nada no seu banco nem no seu sistema: ele só lê os extratos e confere.</span>
            </p>
            <p className="nova-nota">
              <Scale aria-hidden="true" />
              <span>
                O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como &ldquo;o sistema
                diverge do banco&rdquo;. Se o valor no seu sistema estiver diferente, é ele que precisa de ajuste.
              </span>
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

const PASSOS: Passo[] = [
  { titulo: "Envie os dois extratos", texto: "O do banco e o do seu sistema de gestão, do mesmo período." },
  { titulo: "Confira e aponte", texto: "Marque o que conferiu e justifique o que fica como está." },
  { titulo: "Corrija no seu sistema e envie de novo", texto: "Cada nova versão do extrato do sistema vira uma rodada." },
];

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Uma área de soltar em forma de folha: a folha é o rótulo de um input de arquivo invisível, então
 * clicar em qualquer lugar dela abre a escolha, e "Trocar arquivo" é só o aviso de que dá para
 * escolher de novo. O que é solto em cima não passa pelo accept do input: a extensão é conferida aqui.
 */
function FolhaDeExtrato({
  origem,
  titulo,
  dica,
  accept,
  formatos,
  arquivo,
  onArquivo,
  onRecusado,
}: {
  origem: Origem;
  titulo: string;
  dica: string;
  accept: string;
  /** Como o accept aparece no recado de arquivo recusado ("OFX ou CSV"). */
  formatos: string;
  arquivo: File | null;
  onArquivo: (arquivo: File) => void;
  onRecusado: (recado: string) => void;
}) {
  const [arrastando, setArrastando] = useState(false);

  function aoSoltar(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setArrastando(false);
    const solto = event.dataTransfer.files[0];
    if (!solto) return;
    const nome = solto.name.toLowerCase();
    if (!accept.split(",").some((extensao) => nome.endsWith(extensao))) {
      onRecusado(`O ${titulo.toLowerCase()} precisa ser um arquivo ${formatos}.`);
      return;
    }
    onArquivo(solto);
  }

  return (
    <label
      className={`nova-folha nova-folha-${origem}`}
      data-pronto={arquivo ? "" : undefined}
      data-arrastando={arrastando ? "" : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(event) => {
        // sair da folha para um filho dela também dispara o dragleave
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setArrastando(false);
      }}
      onDrop={aoSoltar}
    >
      <span className="rotulo nova-folha-rotulo">
        {/* o ícone de cada lado vira ✓ quando o arquivo entra */}
        <span className="nova-folha-icone">{arquivo ? <Check aria-hidden="true" /> : <IconeOrigem origem={origem} />}</span>
        {origem === "banco" ? "Banco" : "Sistema de gestão"}
      </span>
      <strong className="nova-folha-titulo">{arquivo ? arquivo.name : titulo}</strong>
      {arquivo ? (
        <span className="nova-folha-dica">
          <span>{tamanho(arquivo.size)}</span> · <span className="nova-folha-trocar">Trocar arquivo</span>
        </span>
      ) : (
        <span className="nova-folha-dica">
          <span>{dica}</span>. Solte aqui ou clique para escolher.
        </span>
      )}
      {arquivo && origem === "banco" && (
        <span className="conc-folha-linhas" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <input
        aria-label={titulo}
        className="nova-folha-input"
        type="file"
        accept={accept}
        onChange={(event) => {
          // cancelar a janela de escolha não apaga o arquivo que já estava
          const escolhido = event.target.files?.[0];
          if (escolhido) onArquivo(escolhido);
        }}
      />
    </label>
  );
}

// as etapas do envio na ordem em que acontecem (envio.ts)
const ETAPAS: Etapa[] = ["conferindo", "enviando", "processando", "conciliando"];
// as larguras das barras de valor do banco e do sistema: parecidas, nunca iguais
const LINHAS = [
  [64, 60],
  [56, 46],
  [76, 74],
  [70, 60],
  [66, 64],
  [60, 82],
  [80, 56],
  [72, 66],
  [58, 70],
  [68, 52],
  [74, 62],
  [62, 78],
  [70, 58],
  [66, 72],
];

/**
 * No envio, o palco toma a tela: as duas folhas saem da sobreposição para os lados, as linhas de
 * cada uma entram como barras, sem dado nenhum, e os pares se ligam pelo meio com o ✓ numa onda que
 * não para até a comparação abrir. As linhas são ilustração; o progresso de verdade é a etapa no topo e o texto embaixo.
 */
function Palco({ banco, sistema, etapa }: { banco: string; sistema: string; etapa: Etapa }) {
  const indice = ETAPAS.indexOf(etapa) + 1;
  const folha = (origem: Origem, nome: string) => (
    <div className={`nova-palco-folha nova-palco-${origem}`}>
      <div className="nova-palco-cabeca">
        <span className="rotulo">
          <IconeOrigem origem={origem} tamanho={15} />
          {origem === "banco" ? "Banco" : "Sistema de gestão"}
        </span>
        <span>{nome}</span>
      </div>
      {LINHAS.map((larguras, i) => (
        <div key={i} className="nova-palco-linha" style={{ "--i": i } as CSSProperties} aria-hidden="true">
          <span className="nova-palco-barra" style={{ width: "80%" }} />
          <span className="nova-palco-barra" style={{ width: `${larguras[origem === "banco" ? 0 : 1]}%` }} />
        </div>
      ))}
    </div>
  );
  return (
    <div className="nova-palco">
      <div className="nova-palco-topo">
        <div className="nova-etapas">
          <span className="nova-etapas-barra" aria-hidden="true">
            {ETAPAS.map((nome, i) => (
              <span key={nome} data-feita={i < indice ? "" : undefined} />
            ))}
          </span>
          <span className="nova-etapas-texto">{`Etapa ${indice} de ${ETAPAS.length}`}</span>
        </div>
      </div>
      <div className="nova-palco-mesa">
        {folha("banco", banco)}
        <div className="nova-palco-elos" aria-hidden="true">
          {LINHAS.map((_, i) => (
            <span key={i} className="nova-palco-elo" style={{ "--i": i } as CSSProperties}>
              <span className="nova-palco-marca">
                <Check />
              </span>
            </span>
          ))}
        </div>
        {folha("sistema", sistema)}
      </div>
      {/* a key refaz a entrada a cada etapa: o texto novo chega, não troca de supetão */}
      <div className="nova-palco-rodape" key={etapa} aria-live="polite">
        <p className="nova-palco-recado">{RECADO[etapa as Exclude<Etapa, "ocioso">]}</p>
        <p className="nova-palco-detalhe">{DETALHE[etapa as Exclude<Etapa, "ocioso">]}</p>
      </div>
    </div>
  );
}
