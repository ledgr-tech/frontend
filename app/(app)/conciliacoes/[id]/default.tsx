// Na navegação interceptada (o painel da linha), o slot principal não tem página para a rota
// reescrita: sem este default o Next desiste e navega para a página inteira. Na navegação suave
// a comparação que já estava na tela continua montada; isto só aparece se ela não puder ser
// recuperada.
export default function SemComparacao() {
  return null;
}
