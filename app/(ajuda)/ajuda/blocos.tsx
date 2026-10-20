import { Fragment } from "react";

/** Um texto da ajuda com os **negritos** que marcam botões e opções como aparecem na tela. */
export function Texto({ children }: { children: string }) {
  return children.split("**").map((parte, i) =>
    i % 2 ? <b key={i}>{parte}</b> : <Fragment key={i}>{parte}</Fragment>,
  );
}
