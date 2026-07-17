# Peptídeo é Vida! — site reconstruído

Site estático (HTML/CSS/JS puro, sem build step) que reproduz o catálogo, a
calculadora de dosagem e o contato do site original — corrigindo os
travamentos identificados na auditoria (catálogo paginado em vez de 33 cards
renderizados de uma vez, e apenas uma calculadora montada por vez) e agora
com a identidade visual baseada no template de referência (Baloo 2 para
títulos, painel diagonal azul no hero, ícones de cruz, seção "Como funciona"),
mantendo a logo original.

## Antes de publicar de novo — verifique o domínio

Ao testar `www.peptideoevida.com.br` depois do deploy anterior no Vercel, o
site que carregou **ainda era o antigo** (o mesmo menu quebrado, a mesma
imagem de fundo pesada). Isso quer dizer que o domínio próprio provavelmente
não está apontando para o projeto novo na Vercel — ele deve ainda estar
apontando para a hospedagem antiga (o mesmo lugar que serve
`peptideosystem.netlify.app`). Se o travamento que você viu foi testado
nesse domínio, é bem provável que você estivesse testando o site antigo, não
o corrigido. Vale conferir, no painel da Vercel, em **Settings → Domains**,
se `peptideoevida.com.br` está de fato vinculado a este projeto — e, se não
estiver, atualizar o DNS/nameservers para apontar para lá.

## Arquivos

```
index.html          página principal
privacidade.html     política de privacidade (modelo — revisar com jurídico)
css/styles.css        estilos (mesma paleta/tipografia do site atual)
js/products.js        dados dos 33 peptídeos + configuração da calculadora
js/app.js             toda a lógica: busca, paginação, calculadora, menu, formulário
assets/logo.svg        a mesma logo (ícone de molécula) publicada no site atual
```

Não há passo de build — é só subir estes arquivos como estão.

## Publicar no Netlify

1. Crie um repositório Git com esta pasta (ou arraste a pasta direto no
   painel do Netlify em **Sites → Add new site → Deploy manually**).
2. Build command: deixe em branco. Publish directory: `.` (raiz).
3. Pronto — não precisa de nenhuma outra configuração.

## Publicar no Vercel

1. `vercel` na pasta do projeto, ou importe o repositório pelo painel.
2. Framework preset: **Other**. Build command e output directory: deixe em
   branco (é estático).

## Formulário de contato — passo obrigatório

O formulário original **não enviava a mensagem para lugar nenhum** — ele só
mostrava um alerta de "enviado com sucesso" (`alert(...)` no código-fonte),
mesmo dizendo "Enviar Mensagem (orsicasaro@gmail.com)". Corrigi isso, mas
falta um passo seu porque não tenho como criar uma conta em seu nome:

1. Crie uma conta grátis em [formspree.io](https://formspree.io) e um form.
2. Copie o endpoint (algo como `https://formspree.io/f/xxxxxxx`).
3. Abra `js/app.js`, primeiras linhas, e troque:
   ```js
   const CONTACT_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
   ```
   pelo seu endpoint real.

Até você fazer isso, o botão "Enviar Mensagem" abre o app de e-mail do
usuário com a mensagem pronta (nunca finge que enviou, como antes).

Formspree funciona igual em Netlify e em Vercel, então não precisa escolher
a hospedagem antes de configurar isso.

## A causa real do travamento (encontrada e corrigida)

O widget flutuante do WhatsApp (`.floating-whatsapp-container`) é
`position: fixed`, mas nunca teve largura/altura definida — sua caixa de
layout é do tamanho do conteúdo. O painel do chat (`.whatsapp-bot-window`),
quando fechado, só ficava com `opacity: 0`; ele **continuava ocupando o
espaço dele no layout**, só ficava invisível. Resultado: o container ficava
com uma área bem maior do que o botão redondo visível — um retângulo
invisível de ~300px de largura por várias centenas de pixels de altura,
ancorado no canto inferior direito, em `z-index: 900` (acima de quase tudo
na página).

Esse retângulo invisível cobria, silenciosamente, pedaços do catálogo
embaixo dele — dependendo da posição de rolagem, ele podia estar exatamente
por cima do botão "Calculadora de Dosagem", do campo de busca ou do botão
"Pedir Orçamento". O toque nunca chegava ao botão de verdade: ele era
capturado pelo `<div>` invisível por cima. Confirmei isso com
`document.elementFromPoint()` no exato ponto onde o botão da calculadora
aparece visualmente — o elemento retornado era o `.floating-whatsapp-container`,
não o botão. Testei um clique de verdade (evento `isTrusted: true`, não
simulado por JavaScript) nesse ponto: nada acontecia. Depois da correção, o
mesmo clique chega corretamente ao botão.

Por que isso não aparecia nos meus testes anteriores: eu estava validando os
cliques via `elemento.click()` no JavaScript, que dispara o evento
diretamente no elemento e **pula completamente essa checagem de "o que está
por cima desse ponto na tela"**. Só reproduzi o bug quando simulei um toque
de verdade, coordenada por coordenada — que é exatamente o que o dedo de
quem usa o celular faz.

**Correção:** o container agora tem `pointer-events: none` por padrão, e só
o botão redondo (sempre) e a janela do chat (só quando `.open`) reativam
`pointer-events: auto`. A área invisível não existe mais.

## Calculadora: slider travando e teclado fechando a cada tecla

Depois da correção acima, restaram dois bugs específicos de dentro da
calculadora: o slider ficava lento/travado ao arrastar, e o teclado fechava
a cada caractere digitado nos campos numéricos.

Causa: toda vez que um valor mudava, o código reconstruía o painel inteiro
da calculadora — inclusive os próprios `<input>` — via `innerHTML`. Isso
destrói o elemento e cria um novo idêntico no lugar. Um slider recriado no
meio do arrasto perde o "grude" com o dedo (por isso parecia lento/travado).
Um campo de texto recriado enquanto o teclado está aberto perde o foco, e o
teclado do celular fecha (por isso fechava a cada tecla).

Correção: separei a calculadora em duas partes. Os campos (`calculator-grid`)
são montados **uma única vez**, quando a calculadora abre. A partir daí,
cada mudança só atualiza os números ao redor (concentração, seringa, guia de
reconstituição) e os campos que a pessoa não está usando naquele momento —
nunca o campo/slider ativo. Testei digitando "1234" caractere por caractere
e arrastando o slider em 15 passos simulados: em nenhum dos dois casos o
elemento perdeu identidade ou foco.

## O que mais foi corrigido em relação ao site antigo

- **Envio para o WhatsApp (orçamento por produto, botão geral do CTA e os
  tópicos do widget flutuante) não abre mais em `window.open("_blank")` no
  celular.** Esse método é o recomendado no desktop (abre o WhatsApp Web
  numa aba nova sem perder o site), mas no celular é uma fonte clássica de
  travamento: navegadores embutidos (o do próprio WhatsApp, Instagram,
  TikTok — de onde vem boa parte de quem clica em "Pedir Orçamento") costumam
  bloquear esse popup ou abrir uma aba em branco que fica "carregando" para
  sempre, dando a sensação de site travado. Em toque, o site agora navega na
  própria aba (`window.location.href`), que é o padrão confiável para
  entregar o hand-off ao app do WhatsApp.
- **Slider da calculadora não repinta mais a cada pixel arrastado.** Esse era
  o bug mais provável por trás de "trava ao acessar a calculadora": o código
  original (e minha primeira versão) reconstruía o HTML inteiro do painel
  (grid, resultados, seringa, guia de reconstituição) a cada evento `input`
  — e arrastar um slider no toque dispara esse evento dezenas de vezes por
  segundo. Em um celular, isso satura a thread principal e trava a tela.
  Agora o repaint é limitado a uma vez por frame (`requestAnimationFrame`),
  então arrastar o slider fica liso independente da velocidade do dedo. Isso
  bate diretamente com o problema que você relatou desde a primeira
  mensagem.
- **Catálogo paginado** (9 por página) em vez de 33 cards inteiros montados
  de uma vez — essa era a causa mais provável do travamento ao rolar o
  catálogo em celular.
- **Apenas uma calculadora de dosagem montada por vez**, com a mesma fórmula
  de reconstituição do site original (mcg/mL, mcg por UI, UI a puxar,
  doses por frasco), incluindo os avisos de caneta/spray/ampola.
- **Formulário de contato realmente envia** (ver seção acima) em vez de só
  simular sucesso.
- **Menu mobile com hambúrguer** — antes o item "Fale Conosco" quebrava e
  sobrepunha o layout em telas pequenas.
- **Botão do WhatsApp reposicionado** para não cobrir outros botões no
  mobile.
- **Sem imagem de fundo pesada**: o hero-bg.png de 692&nbsp;KB foi trocado
  por um SVG leve com o mesmo padrão de moléculas — zero peso extra de
  rede.
- **Sem `backdrop-filter` no cabeçalho fixo**: essa propriedade CSS é uma
  das mais pesadas para o Safari do iPhone repintar durante rolagem (o
  navegador precisa re-amostrar tudo por trás do menu a cada frame). O
  cabeçalho agora usa só um fundo branco semi-transparente, visualmente
  quase idêntico, sem esse custo.
- **Política de privacidade** (`privacidade.html`) e checkbox de
  consentimento no formulário, para adequação à LGPD — é um modelo inicial,
  vale revisar com jurídico antes de publicar.

## Identidade visual (template de referência)

O hero, o menu e a seção "Como funciona" foram redesenhados na linha do
template em Canva enviado como referência: painel diagonal azul recortado
por `clip-path`, ícones de cruz espalhados, pílula de destaque no topo do
hero, menu com item ativo em pílula preenchida, e a fonte "Baloo 2" (bold,
arredondada) para todos os títulos — igual ao "Health Care Presentation" do
template. Como o template usa fotos de modelos de banco de imagem (uma
clínica genérica, sem relação com peptídeos), troquei as fotos por uma
ilustração de molécula em SVG no painel do hero — mantém a mesma energia
gráfica sem usar fotografia de terceiros nem fingir ser uma clínica com
equipe própria. A logo é exatamente a mesma do site publicado (extraída
diretamente do código-fonte atual).

## Sobre a calculadora

A fórmula e os textos foram portados fielmente do código-fonte do site
atual (mesma lógica de mcg/mL, UI, seringa U-100 e guia de reconstituição).
Os valores padrão de frasco/dose por peptídeo também são os mesmos.

## Conteúdo do catálogo

Os 33 peptídeos, com posologia, mecanismo, benefícios, efeitos colaterais,
contraindicações, nível de evidência e preço estimado, foram copiados
integralmente do site publicado — nenhum dado foi inventado. Como apontado
na auditoria, vale uma revisão jurídica/regulatória (ANVISA) do conteúdo
antes da publicação, especialmente para as substâncias sujeitas a
prescrição (Semaglutida, Tirzepatida, Retatrutida etc.).

## Performance

Sem framework, sem etapa de build, ~35 KB de JS e CSS somados (antes eram
77 KB de JS + 692 KB de imagem). Cada card usa `content-visibility: auto`
para não custar layout/paint enquanto está fora da tela. Teste em um
celular real antes de divulgar amplamente — foi lá que o site antigo
travava.
