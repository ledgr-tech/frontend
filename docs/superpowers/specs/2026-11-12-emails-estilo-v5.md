# E-mails transacionais no estilo v5

Aprovado em 12/11/2026 no artefato "E-mails do Ledgr no estilo v5"
(https://claude.ai/artifact/3MvJcbXXuTzaULuN3Zi58N). Vale para os 9 e-mails de
`app/services/email/mensagens.py` do backend (develop `3b8d7e0`).

## O problema

- `_pagina` aponta o logo e o mascote para `<FRONTEND_URL>/email/*.png`, e o front
  não servia essa pasta: as imagens nunca apareceram.
- O título sai em Georgia e o corpo em Arial, num cartão branco puro. Nada do guia
  além do botão.

## A parte do front (este PR)

`public/email/` serve, com nomes fixos (o teste `app/email-publico.test.ts` guarda
o contrato):

| Arquivo | O que é |
| --- | --- |
| `logo.png` | o logo de adesivo, 80 px de largura (2× dos 40 px do e-mail) |
| `envelope.png`, `joinha.png`, `comemorando.png`, `neutro.png`, `dupla.png` | as poses do mascote, 224 px (2× dos 112 px) |
| `fontes/inter.woff2`, `fontes/cormorant-garamond-italico.woff2`, `fontes/jetbrains-mono.woff2` | as fatias latinas das fontes do app, com as licenças OFL ao lado |

As fontes ficam no próprio site para o e-mail não chamar o Google: quem abre o
e-mail não vira um acesso registrado em terceiro.

## A parte do backend (fica com o time do backend)

Trocar o molde em `mensagens.py` pelo de baixo. Os textos de cada mensagem não
mudam, salvo o que a tabela do fim diz.

### O molde

```python
# Valores do guia de estilo v5 (app/globals.css do front).
_FUNDO = "#f3f2f2"         # papel
_FOLHA = "#fdfcfa"         # folha do banco: o cartão
_FOLHA_SISTEMA = "#ebe8e3" # o fundo do código do desconto
_TEXTO = "#201f1d"
_APOIO = "#444141"         # neutro-800
_SUAVE = "#605d5d"         # neutro-700, passa 4,5:1 no papel
_FILETE = "#d3d2d1"        # texto a 16% sobre o papel, em cor sólida (Outlook não faz rgba)
_DOURADO = "#b68235"       # só traço: borda do botão, filete do olho
_DOURADO_700 = "#7d5411"   # todo texto dourado
_TERRACOTA_700 = "#8a4934" # o rótulo "Não foi você?"
# Apple Mail, iPhone, Outlook no Mac e Samsung carregam a fonte do site; Gmail e
# Outlook no Windows caem na segunda da lista.
_FONTE = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
_FONTE_DESTAQUE = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
_FONTE_MONO = "'JetBrains Mono', 'Courier New', monospace"
_MONO_ROTULO = (
    f"font-family:{_FONTE_MONO};font-size:10px;font-weight:500;"
    "letter-spacing:0.16em;text-transform:uppercase;"
)


def _fontes(base: str | None) -> str:
    """@font-face com as fontes servidas pelo front; sem base, nada (vale a reserva)."""
    if not base:
        return ""
    url = escape(f"{base}/email/fontes", quote=True)
    return (
        "<style>"
        f"@font-face{{font-family:'Inter';font-weight:400 700;src:url('{url}/inter.woff2') format('woff2');}}"
        "@font-face{font-family:'Cormorant Garamond';font-style:italic;font-weight:500;"
        f"src:url('{url}/cormorant-garamond-italico.woff2') format('woff2');}}"
        "@font-face{font-family:'JetBrains Mono';font-weight:500;"
        f"src:url('{url}/jetbrains-mono.woff2') format('woff2');}}"
        "</style>"
    )


def _p(conteudo_html: str) -> str:
    return f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">{conteudo_html}</p>'


def _link(rotulo: str, url: str) -> str:
    """Link no meio do texto: tinta do texto, sublinhado dourado."""
    return (
        f'<a href="{escape(url, quote=True)}" style="color:{_TEXTO};text-decoration:underline;'
        f'text-decoration-color:{_DOURADO};">{escape(rotulo)}</a>'
    )


def _botao(rotulo: str, url: str) -> str:
    """Contornado como o `.btn-primary` do app, com a seta de quem leva adiante."""
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">'
        f'<tr><td style="border:1px solid {_DOURADO};border-radius:16px;">'
        f'<a href="{escape(url, quote=True)}" style="display:inline-block;padding:11px 24px;'
        f"font-family:{_FONTE};font-size:14px;font-weight:600;color:{_DOURADO_700};"
        f'text-decoration:none;">{escape(rotulo)} &rarr;</a></td></tr></table>'
    )


def _ficha(*linhas: tuple[str, str], mono: bool = False) -> str:
    """Prazos e dados do pedido como linhas de um extrato: rótulo em mono, valor à direita."""
    valor = f"font-family:{_FONTE_MONO};font-size:13px;" if mono else "font-size:14px;"
    corpo = "".join(
        f'<tr><td style="padding:10px 0;border-bottom:1px solid {_FILETE};{_MONO_ROTULO}'
        f'color:{_SUAVE};">{escape(rotulo)}</td>'
        f'<td align="right" style="padding:10px 0 10px 16px;border-bottom:1px solid {_FILETE};'
        f'{valor}font-weight:500;color:{_TEXTO};">{escape(texto)}</td></tr>'
        for rotulo, texto in linhas
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="margin:0 0 18px;border-top:1px solid {_FILETE};">{corpo}</table>'
    )


def _endereco(url: str) -> str:
    """O link por extenso, para quem não consegue clicar no botão."""
    return (
        f'<p style="margin:0 0 22px;font-size:13px;line-height:1.5;color:{_SUAVE};">'
        "Se o botão não funcionar, copie e cole este endereço no navegador:<br>"
        f'<span style="font-family:{_FONTE_MONO};font-size:11.5px;color:{_TEXTO};'
        f'word-break:break-all;">{escape(url, quote=True)}</span></p>'
    )


def _nota(conteudo_html: str) -> str:
    return (
        f'<p style="margin:0;border-top:1px solid {_FILETE};padding-top:16px;font-size:13.5px;'
        f'line-height:1.55;color:{_SUAVE};">{conteudo_html}</p>'
    )


def _aviso(conteudo_html: str) -> str:
    """O "Não foi você?" que fecha os e-mails de conta: rótulo em terracota, texto em tinta."""
    return (
        f'<div style="margin:6px 0 0;border-top:1px solid {_FILETE};padding-top:16px;'
        f'font-size:14px;line-height:1.55;color:{_APOIO};">'
        f'<div style="margin:0 0 4px;{_MONO_ROTULO}color:{_TERRACOTA_700};">Não foi você?</div>'
        f"{conteudo_html}</div>"
    )


def _codigo(codigo: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 22px;">'
        f'<tr><td align="center" style="background:{_FOLHA_SISTEMA};border:1px dashed {_DOURADO};'
        'border-radius:8px;padding:16px 20px;">'
        f'<div style="margin:0 0 6px;{_MONO_ROTULO}color:{_DOURADO_700};">Código</div>'
        f'<div style="font-family:{_FONTE_MONO};font-size:22px;font-weight:500;letter-spacing:0.14em;'
        f'color:{_TEXTO};">{escape(codigo)}</div></td></tr></table>'
    )


def _pagina(olho: str, titulo: str, destaque: str, mascote: str, corpo: str) -> str:
    """Molde de todos os e-mails: assinatura no alto, folha com olho, título em duas
    vozes e mascote, e o rodapé. `olho`, `titulo` e `destaque` são texto fixo (o
    destaque é o fim do título, em itálico); `mascote` é o nome do PNG em
    `<FRONTEND_URL>/email/` (envelope, joinha, comemorando, neutro, dupla)."""
    from app.core.frontend_url import frontend_url_para_link

    base = frontend_url_para_link()
    imagens = escape(f"{base}/email", quote=True) if base else None
    site = escape(base, quote=True) if base else None

    logo = (
        f'<td style="vertical-align:middle;padding-right:10px;"><img src="{imagens}/logo.png" '
        'width="32" alt="" style="display:block;border:0;height:auto;"></td>'
        if imagens
        else ""
    )
    figura = (
        '<td width="112" align="right" style="vertical-align:top;padding-left:16px;">'
        f'<img src="{imagens}/{mascote}.png" width="96" alt="" '
        'style="display:block;border:0;height:auto;max-width:96px;"></td>'
        if imagens
        else ""
    )
    # o endereço escrito é o do próprio site (ledgrfinance.com.br em produção)
    endereco_do_site = (
        f' · <a href="{site}" style="color:{_DOURADO_700};text-decoration:underline;">'
        f'{escape(base.split("//", 1)[-1].rstrip("/"))}</a>'
        if site
        else ""
    )
    return (
        _fontes(base)
        + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'bgcolor="{_FUNDO}" style="background:{_FUNDO};font-family:{_FONTE};color:{_TEXTO};">'
        '<tr><td align="center" style="padding:24px 12px;">'
        '<table role="presentation" width="576" cellpadding="0" cellspacing="0" '
        'style="width:100%;max-width:576px;">'
        # assinatura: logo de adesivo, nome e descritor separados por filete
        '<tr><td style="padding:0 4px 18px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0"><tr>{logo}'
        f'<td style="vertical-align:middle;font-size:20px;font-weight:600;letter-spacing:-0.01em;'
        f'color:{_TEXTO};">Ledgr</td>'
        f'<td style="vertical-align:middle;padding-left:11px;"><div style="border-left:1px solid {_FILETE};'
        f'padding-left:11px;font-size:10px;font-weight:500;letter-spacing:0.18em;'
        f'text-transform:uppercase;color:{_SUAVE};">Conciliação bancária</div></td>'
        "</tr></table></td></tr>"
        # a folha
        f'<tr><td bgcolor="{_FOLHA}" style="background:{_FOLHA};border:1px solid {_FILETE};'
        'border-radius:16px;padding:36px 36px 30px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
        '<tr><td style="vertical-align:top;">'
        f'<div style="margin:0 0 12px;{_MONO_ROTULO}font-size:11px;letter-spacing:0.2em;'
        f'color:{_DOURADO_700};">{olho}'
        f'<span style="display:inline-block;width:32px;height:1px;background:{_DOURADO};'
        'vertical-align:middle;margin-left:10px;"></span></div>'
        f'<h1 style="margin:0;font-family:{_FONTE};font-size:30px;line-height:1.12;font-weight:500;'
        f'letter-spacing:-0.02em;color:{_TEXTO};">{titulo} '
        f'<em style="font-family:{_FONTE_DESTAQUE};font-style:italic;font-weight:500;font-size:1.2em;'
        f'letter-spacing:-0.01em;">{destaque}</em></h1></td>'
        f"{figura}</tr></table>"
        f"{corpo}</td></tr>"
        # rodapé com a frase do guia
        f'<tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.55;color:{_SUAVE};">'
        f'<div style="margin:0 0 4px;font-family:{_FONTE_DESTAQUE};font-style:italic;font-weight:500;'
        f'font-size:16px;color:{_APOIO};">O extrato do banco é sempre a fonte da verdade.</div>'
        f"Equipe Ledgr · Conciliação bancária{endereco_do_site}</td></tr>"
        "</table></td></tr></table>"
    )
```

### Cada e-mail

O texto puro (`texto`) não muda em nenhum. No HTML, os parágrafos são os de
hoje; o que muda está aqui.

| Função | `olho` | `titulo` + `destaque` | Mascote | No corpo |
| --- | --- | --- | --- | --- |
| `mensagem_recuperacao_senha` | `Acesso · senha` | `Redefinir sua` + `senha.` | envelope | O parágrafo da validade vira `_ficha(("Vale por", f"{n} minutos"), ("Uso", "Uma vez só"))`, depois do botão; a nota vira `_aviso("Ignore este e-mail: sua senha atual continua valendo.")` |
| `mensagem_senha_alterada` | `Acesso · senha` | `Sua senha foi` + `alterada.` | joinha | O `_aviso` perde o "Não foi você?" do texto (o rótulo já diz) e usa `_link("tela de login", link)` |
| `mensagem_boas_vindas` | `Cadastro · conta nova` | `Sua conta está` + `pronta.` | comemorando | A empresa vai para `_ficha(("Empresa", razao_social))` e a frase fica "Sua conta na Ledgr foi criada para essa empresa."; a nota vira `_aviso` com o mesmo texto |
| `mensagem_convite` | `Equipe · convite` | `Você foi convidado para a` + `Ledgr.` | **dupla** (era envelope) | A validade vira `_ficha(("Vale por", f"{n} dias"), ("Uso", "Uma vez só"))`; a nota continua `_nota` |
| `mensagem_conta_desativada` | `Conta · desativada` | `Sua conta foi` + `desativada.` | neutro | `_aviso("Avise o nosso suporte agora.")` |
| `mensagem_confirmacao_troca_email` | `Conta · e-mail novo` | `Confirme o seu` + `e-mail novo.` | envelope | Validade em `_ficha`; "Depois da confirmação, você entra na Ledgr com este e-mail." fica como parágrafo; a nota vira `_aviso("Ignore este e-mail: nada muda na conta.")` |
| `mensagem_troca_email_pedida` | `Conta · e-mail` | `Pediram para trocar o seu` + `e-mail.` | envelope | O e-mail mascarado sai da frase ("…para o endereço abaixo.") e vai para `_ficha(("E-mail novo", mascarado), mono=True)` |
| `mensagem_troca_email_concluida` | `Conta · e-mail` | `Seu e-mail foi` + `trocado.` | joinha | Igual ao anterior: `_ficha(("E-mail novo", mascarado), mono=True)` |
| `mensagem_cupom` | `Assinatura · desconto` | `Um desconto para a sua` + `conta.` | joinha | Com código: `_ficha(("Desconto", desconto), ("Vale até", validade), ("Uso", "Uma vez só, nesta conta"))` e `_codigo(codigo)`; "(abrir)" vira `_link("Assinatura", link)` no lugar do nome da tela |

## Verificar no backend

- Os testes de `mensagens.py` que comparam trechos do HTML (o `_pagina` muda de
  assinatura: cinco argumentos).
- Enviar um de cada para uma caixa no Gmail e outra no Apple Mail antes de ligar
  em produção. No Gmail o título cai em Arial + Georgia itálico; é o esperado.
- `FRONTEND_URL` de produção precisa servir `/email/` (este PR, depois do release
  do front).
