// O mesmo prazo da página inteira (`[linha]/layout.tsx`): a explicação da divergência sai por uma
// Server Action, e o backend espera até 20 s pelo provedor de IA.
export const maxDuration = 60;

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
