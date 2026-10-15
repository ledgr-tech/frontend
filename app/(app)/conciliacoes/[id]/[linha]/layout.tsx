// Existe só pela configuração: a página é client component e não pode exportá-la.
// A explicação da divergência (POST /explicacoes) sai por uma Server Action desta
// página, e o backend espera até 20 s pelo provedor de IA. 60 s cobre isso com
// folga e cabe no teto da Vercel em qualquer plano, sem depender do padrão de
// cada um.
export const maxDuration = 60;

export default function LinhaLayout({ children }: LayoutProps<"/conciliacoes/[id]/[linha]">) {
  return children;
}
