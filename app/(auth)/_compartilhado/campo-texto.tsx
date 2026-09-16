"use client";

import { useState, type ReactNode, type Ref } from "react";
import { MensagemErro } from "./mensagem-erro";
import { OlhoMascote } from "./olho-mascote";

type PropsCampoTexto = {
  id: string;
  rotulo: string;
  valor: string;
  onValor: (valor: string) => void;
  tipo?: "text" | "email" | "password";
  /** exemplo de preenchimento: só aparece com o campo em foco, quando o rótulo já subiu para a borda */
  exemplo?: string;
  /** botão com o olho do mascote para mostrar ou ocultar a senha */
  alternarSenha?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "email";
  autoCapitalize?: string;
  maxLength?: number;
  disabled?: boolean;
  erro?: string;
  /** alterna entre "a" e "b" a cada erro novo para o CSS repetir o tremor */
  tremor?: "a" | "b";
  /** id do texto de apoio (children) que descreve o campo enquanto não há erro */
  ajudaId?: string;
  ref?: Ref<HTMLInputElement>;
  /** texto de apoio abaixo do campo; dá lugar à mensagem de erro quando ela existe */
  children?: ReactNode;
};

/** Campo das telas de acesso com rótulo flutuante: o nome começa dentro do campo e sobe para a borda ao focar ou preencher. */
export function CampoTexto({
  id,
  rotulo,
  valor,
  onValor,
  tipo = "text",
  exemplo,
  alternarSenha = false,
  autoComplete,
  inputMode,
  autoCapitalize,
  maxLength,
  disabled,
  erro,
  tremor,
  ajudaId,
  ref,
  children,
}: PropsCampoTexto) {
  const [verSenha, setVerSenha] = useState(false);
  const comOlho = tipo === "password" && alternarSenha;
  const erroId = `${id}-erro`;

  return (
    <div className="field">
      {/* quem treme é o bloco inteiro (input, rótulo e olho); com foco nele, o olho do mascote se projeta à frente */}
      <div className={comOlho ? "campo-flutuante login-senha-campo" : "campo-flutuante"} data-tremor={tremor}>
        <input
          ref={ref}
          id={id}
          className="input"
          type={comOlho && verSenha ? "text" : tipo}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          // um espaço quando não há exemplo: o CSS usa :placeholder-shown para saber se o campo está vazio
          placeholder={exemplo ?? " "}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : ajudaId}
          disabled={disabled}
          value={valor}
          onChange={(evento) => onValor(evento.target.value)}
          style={{ minHeight: 50, fontSize: 16, padding: comOlho ? "12px 54px 12px 18px" : "12px 18px" }}
        />
        {/* depois do input no DOM: o CSS sobe o rótulo com input:focus + label */}
        <label htmlFor={id} className="campo-flutuante-rotulo">
          {rotulo}
        </label>
        {comOlho && (
          <button
            type="button"
            className="login-ver-senha"
            aria-controls={id}
            aria-pressed={verSenha}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            title={verSenha ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVerSenha((atual) => !atual)}
          >
            <OlhoMascote fechado={verSenha} />
          </button>
        )}
      </div>
      {erro ? <MensagemErro id={erroId}>{erro}</MensagemErro> : children}
    </div>
  );
}
