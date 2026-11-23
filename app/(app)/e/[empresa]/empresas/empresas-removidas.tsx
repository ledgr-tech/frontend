"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmpresaCliente } from "@/lib/adaptadores";
import { useRoteador } from "@/lib/roteador";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";
import type { Resultado } from "../conciliacoes/acoes";
import { formatarDataHora } from "../dashboard/resumo";
import { BotaoFecharJanela, ModalDaTela } from "./modal-da-tela";
import { carregarEmpresasRemovidas, removerEmpresa, restaurarEmpresa, type EmpresaRemovida } from "./remocao-acoes";

export function ConfirmarRemocao({ empresa, aoFechar, aoRemover }: {
  empresa: EmpresaCliente;
  aoFechar: () => void;
  aoRemover: (empresa: EmpresaRemovida) => void;
}) {
  const router = useRoteador();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);

  async function confirmar() {
    if (emCurso.current) return;
    emCurso.current = true;
    setEnviando(true);
    setErro(null);
    const resposta = await removerEmpresa(empresa.id).catch(
      (): Resultado<EmpresaRemovida> => ({ ok: false, status: 0, erro: SEM_SERVIDOR }),
    );
    emCurso.current = false;
    setEnviando(false);
    if (resposta.ok) {
      aoRemover(resposta.dados);
      return;
    }
    if (resposta.status === 401) router.push("/login");
    setErro(resposta.erro);
    if (resposta.status === 403) router.refresh();
  }

  return (
    <ModalDaTela titulo="Remover empresa" aoFechar={aoFechar} ocupado={enviando}>
      <p className="dialog-body">Remover <strong>{empresa.nome}</strong> ({formatarCnpj(empresa.cnpj)}) do escritório?</p>
      <p className="dialog-body">Ela sai do seletor e das consultas imediatamente. Você pode restaurá-la por 30 dias; depois desse prazo, os dados serão apagados.</p>
      <p className="dialog-body">As chaves de API e as conexões MCP serão revogadas e precisarão ser criadas novamente se você restaurar a empresa. A remoção não devolve a franquia já usada no mês.</p>
      {erro && <p role="alert" className="empresas-nota">{erro}</p>}
      <div className="empresas-form-botoes">
        <BotaoFecharJanela aoFechar={aoFechar} className="btn btn-secondary" disabled={enviando} autoFocus>Cancelar</BotaoFecharJanela>
        <button type="button" className="btn btn-primary" disabled={enviando} onClick={() => void confirmar()}>
          {enviando ? "Removendo…" : "Confirmar remoção"}
        </button>
      </div>
    </ModalDaTela>
  );
}

export function EmpresasRemovidas({ aoFechar, aoRestaurar }: {
  aoFechar: () => void;
  aoRestaurar: (empresa: EmpresaCliente) => void;
}) {
  const router = useRoteador();
  const [empresas, setEmpresas] = useState<EmpresaRemovida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const emCurso = useRef(false);
  const montada = useRef(true);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (aviso && restaurando === null) botaoFechar.current?.focus();
  }, [aviso, restaurando]);

  const receberLista = useCallback((resposta: Resultado<EmpresaRemovida[]>) => {
    if (!montada.current) return;
    setCarregando(false);
    if (resposta.ok) {
      setEmpresas(resposta.dados);
      setErro(null);
    } else {
      setErro(resposta.erro);
      if (resposta.status === 401) router.push("/login");
    }
  }, [router]);

  async function carregar() {
    const resposta = await carregarEmpresasRemovidas().catch(
      (): Resultado<EmpresaRemovida[]> => ({ ok: false, status: 0, erro: SEM_SERVIDOR }),
    );
    receberLista(resposta);
  }

  useEffect(() => {
    montada.current = true;
    let cancelada = false;
    void carregarEmpresasRemovidas().catch(
      (): Resultado<EmpresaRemovida[]> => ({ ok: false, status: 0, erro: SEM_SERVIDOR }),
    ).then((resposta) => { if (!cancelada) receberLista(resposta); });
    return () => { cancelada = true; montada.current = false; };
  }, [receberLista]);

  async function restaurar(empresa: EmpresaRemovida) {
    if (emCurso.current) return;
    emCurso.current = true;
    setRestaurando(empresa.id);
    setErro(null);
    setAviso(null);
    const resposta = await restaurarEmpresa(empresa.id).catch(
      (): Resultado<EmpresaCliente> => ({ ok: false, status: 0, erro: SEM_SERVIDOR }),
    );
    emCurso.current = false;
    if (!montada.current) return;
    setRestaurando(null);
    if (resposta.ok) {
      setEmpresas((atuais) => atuais.filter((outra) => outra.id !== empresa.id));
      setAviso(`${empresa.nome} foi restaurada. As chaves de API e as conexões MCP precisam ser criadas novamente.`);
      aoRestaurar(resposta.dados);
    } else {
      setErro(resposta.erro);
      if (resposta.status === 401) router.push("/login");
      if (resposta.status === 402 || resposta.status === 403) router.refresh();
      // Prazo vencido ou restauração em outra aba: relê a lista, mantendo o motivo da recusa.
      if (resposta.status === 404) {
        const atual = await carregarEmpresasRemovidas().catch(() => null);
        if (montada.current && atual?.ok) setEmpresas(atual.dados);
      }
    }
  }

  return (
    <ModalDaTela titulo="Empresas removidas" aoFechar={aoFechar} ocupado={restaurando !== null}>
      <p className="dialog-body">As empresas podem ser restauradas até a data indicada, dentro do limite do plano.</p>
      <p role="status" className={carregando || aviso ? "empresas-nota" : "sr-only"}>{carregando ? "Carregando empresas removidas…" : aviso}</p>
      {erro && <p role="alert" className="empresas-nota">{erro}</p>}
      {!carregando && !erro && empresas.length === 0 && <p className="dialog-body">Nenhuma empresa removida disponível para restaurar.</p>}
      <ul className="empresas-removidas-lista">
        {empresas.map((empresa) => (
          <li key={empresa.id} className="card">
            <strong>{empresa.nome}</strong>
            <p className="dialog-body">{formatarCnpj(empresa.cnpj)}</p>
            <p className="dialog-body">Removida em {formatarDataHora(empresa.removidaEm)} por {empresa.removidaPor}. Restaurar até {formatarDataHora(empresa.apagarEm)}.</p>
            <button type="button" className="btn btn-secondary" disabled={restaurando !== null} onClick={() => void restaurar(empresa)} aria-label={`Restaurar ${empresa.nome}`}>
              {restaurando === empresa.id ? "Restaurando…" : "Restaurar empresa"}
            </button>
          </li>
        ))}
      </ul>
      <div className="empresas-form-botoes">
        {erro && <button type="button" className="btn btn-secondary" disabled={carregando || restaurando !== null} onClick={() => { setCarregando(true); void carregar(); }}>Atualizar lista</button>}
        <BotaoFecharJanela ref={botaoFechar} aoFechar={aoFechar} className="btn btn-secondary" disabled={restaurando !== null}>Fechar</BotaoFecharJanela>
      </div>
    </ModalDaTela>
  );
}
