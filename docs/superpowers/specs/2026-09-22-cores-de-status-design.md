# Ledgr — Cores de status

## Contexto

O sistema tinha um matiz só. O design (`NIVEIS` em `Ledgr.dc.html`) distinguia
gravidade por **intensidade de ouro**: `leve` → ouro-300, `medio` → ouro base,
`forte` → ouro-700. Na prática, "Divergência de valor" e "Sem correspondência"
chegavam na tela como dois tons do mesmo dourado — só a saturação diferia, e
nenhuma cor dizia o que a linha era.

## O que mudou

O eixo passou de **intensidade** para **matiz**. Três papéis:

| Papel | Matiz | Significa | Onde |
|---|---|---|---|
| `ok` | verde H=148 | resolvido | Match exato, Conciliado, Fechado, taxa de match, regra Aprendida |
| `atencao` | ouro H=73.6 | pendente, incompleto | Sem correspondência, Fechado com ressalva, regra Sugerida, padrão crônico |
| `risco` | terracota H=37.9 | o dinheiro não confere | Divergência de valor, valor em divergência, Δ, lado que precisa de ajuste |
| `neutro` | sem cor | sem status | regra Padrão |

## Decisões

1. **As rampas foram geradas na escala do ouro, não inventadas.** Medi a rampa
   existente em OKLCH: L de 0.9695 a 0.2897 nos nove passos, croma num arco que
   pica em 500 (0.1126), matiz fixo em 73.6. As duas novas usam **exatamente os
   mesmos L e croma** — só o matiz muda. É por isso que o passo 300 de qualquer
   papel pesa igual na página. A fórmula reproduz `#b68235` a partir da base do
   ouro, o que confirma que o sistema original foi construído assim.

2. **A terracota reusa o matiz que já existia.** `--color-erro: #a94f33` (H=37.9)
   estava no `globals.css` descrito como "terracota que conversa com o dourado".
   A rampa `risco` sai desse matiz em vez de um vermelho novo — um vermelho a mais
   seria um vermelho a mais para o sistema carregar.

3. **O verde é H=148, não 132.** O 132 é oliva, a ~58° do ouro, e em croma baixo
   passaria por "ouro esverdeado". O 148 fica a ~74° — o mesmo espaçamento que a
   terracota tem do outro lado, então os três se separam sem ambiguidade.

4. **A base do verde é 0.025 de L mais escura que a do ouro**, de propósito:
   `#5aa066` na luminosidade compartilhada dava 2.82:1, abaixo do piso de 3:1 para
   texto grande. Luminância WCAG e L do OKLab discordam justamente no verde. A base
   virou `#52985e`, 3.13:1 — diferença de peso imperceptível, contraste resolvido.

5. **A receita do selo foi calibrada no navegador, não na planilha.** Minha conta
   à mão previa 4.5–4.8:1; medido renderizado deu **4.18–4.34**, reprovando o
   4.5:1 que texto de 12.5px exige. A receita final é igual para os três papéis —
   texto no 700 sobre 8% do 700, borda carregando o matiz — e mede **ok 4.71,
   risco 5.12, atenção 5.02**. Preenchimento mais fraco com borda colorida é, de
   quebra, mais fiel ao "cor como traço, não preenchimento" do `_ds/readme.md`.

6. **O `nivel` da regra foi deletado, não traduzido.** Era um campo por regra que
   não dizia nada além de "mais ou menos ouro". O tom agora sai da procedência
   (`tomDaRegra`): Aprendida já trabalha por você (ok), Padrão é mobília (neutro),
   Sugerida espera decisão (atenção).

7. **O gráfico do histórico foi para o verde.** Ele mede taxa de match, que é a
   métrica "ok" — e a mesma métrica já tinha virado verde na dashboard. Continua
   rampa **sequencial**, não categórica: é uma série ao longo do tempo, então o
   claro→forte marca o tempo passando, não seis categorias diferentes.

8. **O ouro não foi substituído, foi promovido.** Ele é marca e chrome: item ativo
   do menu, botões, kickers, "Fonte da verdade", o mascote. Verde e terracota são
   **reservados a status** e não entram no chrome — é o que impede a tela de virar
   semáforo.

9. **O matiz nunca é o único sinal.** Vermelho e verde são exatamente o par que ~8%
   dos homens não distingue. Todo selo carrega o rótulo por escrito ("Match exato",
   "Divergência de valor"), todo número tem seu label, e todo aviso tem seu texto
   ao lado do ponto. Tirando a cor, nada de informação se perde.

## Ficou de fora

- **`--color-erro` continua em `#a94f33`**, fora da rampa (fica entre o risco-600 e
  o risco-700). É a cor de erro dos formulários de login e cadastro, telas que não
  estavam neste escopo. Alinhar `--color-erro: var(--color-risco-600)` é mudança de
  uma linha, mas mexe em duas telas já verificadas — vale fazer junto com a próxima
  visita a elas.

## Verificado no navegador

Contrastes medidos no DOM renderizado, compondo as camadas de fundo de verdade:

- **Selos** (12.5px, precisa 4.5:1): ok 4.71 · risco 5.12 · atenção 5.02.
- **Números grandes** (44px, precisa 3:1): match 3.13 · divergência 3.09.
- **Texto do sistema**, no cartão de detalhe: terracota-700, e o Δ em terracota base.
