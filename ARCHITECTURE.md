Arquitetura — Kurio NFT Marketplace

Este documento registra as decisões técnicas, os contratos, a política de sessão e cache, a reconciliação REST ↔ Socket.IO, as limitações e os desvios do Figma.

Demo: https://kurionftmarketplace.vercel.app/ · Repositório: https://github.com/SamuelVarjao/kurio_nft_marketplace

1. Visão geral

O app não conhece os mocks. Componentes, hooks e o cliente Axios não têm respostas fictícias nem caminhos alternativos. Os mocks são carregados só por "src/main.tsx", conforme a configuração ("VITE_ENABLE_MOCKS").
Um único estado simulado ("src/mocks/db/store.ts") serve os handlers REST e o servidor Socket.IO. Toda mudança de preço ou disponibilidade passa por "mutateNft()", que incrementa a versão, persiste e emite "nft.updated". Por isso REST e eventos nunca divergem.

2. Organização

src/contracts: Contratos REST e de eventos (tipos) e schemas zod compartilhados entre o cliente e o servidor simulado 
src/lib: Cliente Axios, normalização de erros (ApiError), política de cache e chaves (query.ts), aritmética decimal de ETH (eth.ts), anúncios acessíveis 
src/features: Hooks de dados e telas por domínio (catálogo, NFT, carrinho, checkout, pedidos, conta, auth, realtime) 
src/routes: Rotas file-based do TanStack Router (routeTree.gen.ts é gerado) 
src/components/ui: Componentes shadcn/ui adaptados à identidade Kurio 
src/components/kurio, layout: Componentes da marca (imagem responsiva, stepper, campos, header/footer/nav) 
src/mocks: MSW: fixtures, banco, handlers, cenários, Socket.IO simulado e API de controle ("window.__KURIO_MOCKS__") 
e2e: Testes do Playwright 
lighthouse: Configuração, script e relatórios da auditoria 

3. Decisões dos pontos ambíguos

Onde guardar a sessão
Token bearer opaco em localStorage (kurio:session), enviado em Authorization: Bearer. Motivo: Sobrevive a refresh e é legível fora do React (interceptor, guards, socket). Tem-se ciência que o mais apropriado seria a utilização de cookies, porém o desenvolvedor entende que o enunciado permite a opção deferida.

Item do carrinho que esgota
Fica no carrinho, marcado como indisponível (status: 'unavailable'). Sai do subtotal e da cotação ("QuoteResponse.excluded"). Motivo: A indisponibilidade é melhor informada ao usuário desta maneira e o próprio decide se remove, e a decisão aparece na interface e no anúncio acessível. 

Edições × quantidade
Cada edição vendida equivale a 1 NFT (1 token). Cada NFT tem níveis de edição: "1/1" (1 cópia), "1/10", "1/50" e "ABERTA" (sem teto). "available" é o número de cópias restantes do nível. A quantidade comprada é o número de cópias desse nível e respeita "min(available, maxPerOrder)". A disponibilidade é por NFT e por edição. Motivo: Interpretação do desenvolvedor ao enunciado.

Relógio e eventos no Playwright 
page.clock controla o tempo (timeouts do Axios, delay() do MSW, resolução de pedidos). Os eventos são disparados por window.__KURIO_MOCKS__ via page.evaluate, sem passar pela UI: a mudança acontece no servidor simulado e chega pelo "socket.io-client". Motivo: os eventos seguem o mesmo caminho de produção e o tempo fica determinístico.

Build
Vite 6. Motivo: O desenvolvedor, Samuel Varjão, possui familiaridade.

4. Contratos REST

Base /api. Os erros seguem um envelope único:

json
{ "error": { "code": "QUOTE_CHANGED", "message": "…", "fields": { "campo": "mensagem" }, "details": {}, "retryable": false } }

Código: "VALIDATION_FAILED" HTTP: 400/422 Quando: Payload inválido (o campo vai em "fields") 
Código: "INVALID_CREDENTIALS" HTTP: 401 Quando: Login com e-mail ou senha incorretos 
Código: "SESSION_INVALID" / "SESSION_EXPIRED" HTTP: 401 Quando: Token ausente, desconhecido ou expirado 
Código: "FORBIDDEN" HTTP: 403 Quando: Recurso de outro usuário (pedido) ou cenário "forbidden" 
Código: "NOT_FOUND" HTTP: 404 Quando: NFT, pedido, item ou edição inexistente 
Código: "CONFLICT" HTTP: 409 Quando: E-mail ou usuário já cadastrado, endereço de carteira duplicado 
Código: "AVAILABILITY_CONFLICT" HTTP: 409 Quando: Quantidade acima do disponível ou edição esgotada 
Código: "QUOTE_CHANGED" HTTP: 409 Quando: Cotação desatualizada ("details.quote" traz a nova) 
Código: "IDEMPOTENCY_CONFLICT" HTTP: 409 Quando: Mesma "Idempotency-Key" com corpo diferente 
Código: "WALLET_REJECTED" HTTP: 409 Quando: Carteira recusou a conexão ou foi desconectada 
Código: "COUPON_INVALID" / "COUPON_EXPIRED" HTTP: 422 Quando: Cupom inválido ou expirado 
Código: "TRANSIENT_FAILURE" / "INTERNAL" HTTP: 5xx/429 Quando: Falhas transitórias ("retryable: true") 

Sessão. Operação: "POST /auth/register" · "POST /auth/login" → "SessionResponse" · "GET /auth/session" · "POST /auth/logout" Nota: a senha é armazenada como "sha256(salt:senha)"
NFTs Operação: "GET /nfts?q&categories&networks&minPrice&maxPrice&sort&tab&page&pageSize" → "CatalogResponse" (itens, "facets", "applied") · "GET /nfts/featured" · "GET /nfts/:id" (id ou slug) · "GET /nfts/:id/related" Nota: "applied" devolve os parâmetros efetivamente usados 
Favoritos. Operação: "GET /favorites" · "PUT /favorites/:nftId" · "DELETE /favorites/:nftId" Nota: Exige autenticação 
Carrinho. Operação: "GET /cart" · "POST /cart/items" · "PATCH /cart/items/:lineId" · "DELETE /cart/items/:lineId" · "PUT/DELETE /cart/coupon" · "POST /cart/acknowledge" · "POST /cart/merge" Nota: O visitante é identificado pelo cabeçalho "X-Cart-Id"; o usuário, pelo token 
Cotação. Operação: "POST /quotes { network }" → "QuoteResponse" ("fingerprint", "blockers", "excluded", "expiresAt") Nota: Revalida preço, disponibilidade, cupom e taxa 
Carteira conectada. Operação: "POST /wallet-connections" · "GET /wallet-connections/active" · "DELETE /wallet-connections/:id" Nota: Simula a conexão, a recusa e a desconexão 
Pedidos. Operação: "POST /orders" (cabeçalho "Idempotency-Key") · "GET /orders/:id" · "GET /orders?status" Nota: A mesma chave com o mesmo corpo devolve o mesmo pedido; com corpo diferente, 409 
Perfil. Operação: "GET/PATCH /profile" · "PUT/DELETE /profile/avatar" (data URL ≤ 250 KB) · "POST /profile/password" Nota: Trocar a senha encerra as demais sessões 
Carteiras. Operação: "GET /wallets" · "PUT /wallets/:slot" ("primary"/"secondary") · "PUT /wallets/secondary/same-as-primary" 

Os tipos completos estão em "src/contracts/index.ts", e as regras de validação em "src/contracts/schemas.ts". O servidor simulado usa esses mesmos schemas para validar os dados recebidos.

Valores em ETH

Os valores trafegam como strings decimais (""1.19""). "src/lib/eth.ts" converte para wei ("BigInt", 18 casas) para somar, multiplicar por quantidades inteiras e aplicar percentuais (pontos-base). "formatEth" nunca arredonda casas significativas. A interface exibe exatamente o que a API calculou: subtotal, desconto, taxa e total vêm prontos do servidor. O cliente só formata.

5. Eventos (Socket.IO)

Envelope comum ("RealtimeEnvelope"):

ts
{ eventId: string, type, resource: { type, id }, version: number, occurredAt: string, userId?: string, data }

Evento: "nft.updated". data: "price", "previousPrice", "soldOut", "editions[]" ("id", "price", "available"). Função: Aplica a mudança em "['nft', id]", nas listas do catálogo, nos relacionados e nos destaques. Invalida o carrinho, avisa o usuário (toast + "aria-live") e recalcula a cotação do checkout 
Evento: "order.updated". data: "status", "transactionHash", "failureReason". Função: Atualiza "['private', userId, 'order', id]". Se o status for terminal, invalida o carrinho e leva ao recibo ou à recusa 
Evento: "session.ready". data: "{ userId }". Função: Confirmação da identificação 
Evento: "session.identify" (cliente → servidor). data: "{ token }". Função: Associa a conexão ao usuário 

Regras do cliente ("src/features/realtime/events.ts"):

1. Um "eventId" já visto é descartado como duplicata (memória LRU de 500 eventos).
2. Um evento com "version" ≤ maior versão conhecida é descartado. A versão conhecida é o máximo entre a dos eventos e a do cache REST, então um refetch mais novo nunca regride.
3. Um "order.updated" com "userId" diferente do usuário atual é descartado. Eventos de uma sessão anterior não afetam outro usuário.
4. Um pedido "confirmed" ou "rejected" é terminal e não muda mais.

Ciclo de vida: existe um socket por sessão ("session.generation"). Login, logout ou troca de usuário destroem o socket anterior com "removeAllListeners()" + "disconnect()" e criam outro.

Reconciliação após reconexão: no "connect" seguinte ao primeiro, as consultas ativas de catálogo, detalhe, carrinho e pedidos são invalidadas e refeitas via REST. Enquanto o socket está fora, um pedido pendente também é consultado por polling a cada 3 s; com o socket ativo, a cada 15 s, só como garantia.

6. Política de sessão

"POST /auth/login" ou "/register": "sessionStore.start()" grava o token, o "expiresAt" e o usuário, e incrementa "generation".
Refresh: a sessão é lida do "localStorage" e revalidada com "GET /auth/session".
Expiração durante a navegação:
  o guard "_authed" verifica a expiração local antes de entrar em rotas privadas;
  um timer em "SessionEffects" consulta o servidor quando "expiresAt" passa;
  qualquer 401 "SESSION_EXPIRED"/"SESSION_INVALID" referente ao token atual encerra a sessão no interceptor do Axios.

  Em seguida, os caches privados são removidos e o usuário vai para "/entrar?redirect=<rota atual>&reason=expired".
Expiração durante o checkout: o rascunho do formulário fica em "sessionStorage" ("kurio:checkout-draft:<userId>") e a tentativa de pedido em "localStorage". Depois de entrar de novo, "redirect" devolve o usuário a "/pagamento" com os dados preenchidos.
Logout e troca de usuário: "removeQueries(['private'])" e "removeQueries(['cart'])", socket recriado e versões de pedidos esquecidas.
Isolamento: todo dado privado fica sob a chave "['private', userId, …]", e o carrinho sob "['cart', 'user:<id>' | 'guest']".

7. Estado do carrinho

- Fonte da verdade: o servidor. O visitante recebe um "cartId", guardado em "kurio:guest-cart" e enviado em "X-Cart-Id", que sobrevive a refresh.
- Ao autenticar: "POST /cart/merge" soma as linhas do visitante ao carrinho do usuário, respeitando o limite por edição. Depois, o carrinho do visitante é descartado.
- Status por linha: "ok", "price_changed" (preço atual ≠ preço na inclusão), "insufficient" (quantidade acima do disponível; impede o checkout) ou "unavailable" (esgotado: marcado, sem cobrança e fora da cotação).
- Cupom: fica no carrinho. Um código inválido ou expirado retorna 422 e o motivo aparece no campo.
- Após confirmação: o servidor subtrai apenas as quantidades compradas, linha a linha. Em caso de recusa, as reservas são liberadas e os itens permanecem.

8. Pagamento: revalidação e idempotência

1. A cotação ("POST /quotes") é criada ao abrir o pagamento e recriada quando a rede ou o carrinho mudam (mudança feita pelo usuário: aceita automaticamente) ou quando chega um "nft.updated" de um item cotado (mudança externa).
2. Se o "fingerprint" muda em relação à cotação que o usuário aceitou, aparece o aviso "A cotação mudou", com a diferença por item e total. Confirmar compra fica bloqueado até o usuário clicar em "Aceitar nova cotação".
3. Confirmar compra: valida o formulário, conecta a carteira (a recusa é tratada), refaz a cotação e abre a revisão.
4. Confirmar e pagar: "POST /orders" com "Idempotency-Key". O servidor revalida tudo de novo; se algo mudou, devolve "409 QUOTE_CHANGED" com a nova cotação e o usuário precisa confirmar outra vez.
5. Duplicação:
  - a mesma promessa é reutilizada em cliques repetidos;
  - a chave e o corpo ficam persistidos ("kurio:checkout-attempt:<userId>");
  - timeout, falha de rede ou 5xx geram até 3 reenvios com a mesma chave;
  - um corpo diferente gera chave nova.
6. Recuperação: ao recarregar ou reconectar, a tentativa persistida é retomada. Se tem "orderId", o pedido é acompanhado; se não tem (a resposta se perdeu), é reenviada com a mesma chave e o servidor devolve o mesmo pedido.
7. Confirmação: a tela de recibo só aparece para um pedido "confirmed" e mostra exclusivamente o snapshot "order.receipt". Mudanças posteriores no catálogo não alteram o recibo.

9. Cache, retries e sincronização

Dado:  Catálogo ("['catalog', params]"). staleTime: 30 s. Atualização: "placeholderData: keepPreviousData"; "signal" do Axios cancela consultas obsoletas; eventos "nft.updated"; invalidação após reconexão 
Dado:  Destaques. staleTime: 5 min. Atualização: Eventos 
Dado:  Detalhe ("['nft', id]"). staleTime: 30 s. Atualização: Eventos e reconexão 
Dado:  Carrinho. staleTime: 10 s. Atualização: "setQueryData" com a resposta de cada mutation; invalidação por "nft.updated" e por pedido terminal 
Dado:  Favoritos. staleTime: 30 s. Atualização: Atualização otimista com rollback ("onMutate"/"onError") e "invalidate" no "onSettled" 

Retries de consulta: só para erros "retryable" (rede, timeout, 5xx, 429), até 2 novas tentativas, com backoff de 800 ms × 2ⁿ (máx. 4 s). Erros 4xx não são repetidos.
Mutations: não repetem automaticamente. A exceção é o pedido, que repete com idempotência explícita (ver §8).
Respostas fora de ordem: cada combinação de parâmetros tem sua própria chave de cache, e o "AbortSignal" cancela a requisição anterior. Uma resposta atrasada nunca sobrescreve a consulta atual. O cenário "variable-latency" exercita isso.

10. Mocks (MSW)

Ativação: "VITE_ENABLE_MOCKS" (padrão "true"). Os mocks também vão no build de demonstração (Vercel).
Persistência: o banco fica em "localStorage" ("kurio:mock-db:v1"). Reset: "__KURIO_MOCKS__.reset()" restaura as fixtures e zera os contadores; "resetAll()" faz o mesmo, limpa a sessão, o carrinho do visitante e as tentativas de checkout do navegador e recarrega a página.
Fixtures:
 72 NFTs determinísticos (os 9 do Figma e mais 63 gerados por PRNG com semente fixa), distribuídos em 9 categorias e 3 redes, com preços de 0.02 a 12.30;
 um NFT totalmente esgotado e um com edição escassa;
 2 usuários;
 cupons válidos e expirado.
Cenários: definidos em "src/mocks/scenarios.ts" e selecionados por "?scenario=", pelo "localStorage" ou por "setScenario()" (console/Playwright). A latência é calculada de forma determinística a partir do contador de requisições.
Sem interface de mocks: o desafio não pede uma, então não há painel nem botão no site. Os cenários e os eventos são controlados apenas pela URL ("?scenario="), pelo console ("window.__KURIO_MOCKS__") e pelos testes.
Credenciais: a senha fictícia aparece apenas no README. O banco simulado guarda só o hash com sal, e os testes leem a senha de "E2E_PASSWORD" (".env.e2e.local", não versionado). Nenhuma senha em texto puro fica no código.
Socket.IO: o transporte é a interceptação de WebSocket do MSW ("ws.link") com "@mswjs/socket.io-binding". O cliente real ("socket.io-client") conecta em "wss://realtime.kurio.test/socket.io/" com "transports: ['websocket']".

Limitações do transporte simulado:

Sem long-polling: o MSW intercepta só WebSocket, por isso "transports: ['websocket']".
Handshake sintetizado pelo binding: a identificação da sessão é feita pelo evento "session.identify" após o "connect", e não pelo "auth" do handshake.
Sem rooms, namespaces ou acks: a difusão para "salas" por usuário é filtrada no servidor simulado por "userId".
Heartbeat manual: o binding anuncia "pingInterval" de 25 s, e o servidor simulado envia "ping" a cada 20 s.
Host dedicado: o MSW remove o prefixo "/socket.io/" antes de casar a URL; usar o mesmo host da página capturaria também o WebSocket de HMR do Vite.
Import sob demanda: o "engine.io-client" captura "globalThis.WebSocket" ao ser avaliado. Por isso o "socket.io-client" é importado dinamicamente depois que o MSW inicia.
Escopo por aba: o estado e os eventos são locais a cada aba (cada aba tem seu servidor simulado). Duas abas compartilham o "localStorage", mas não recebem os eventos uma da outra.

11. Acessibilidade

- Link "Pular para o conteúdo", foco visível (":focus-visible" com anel laranja) e navegação completa por teclado.
- Diálogos e drawers (Radix) prendem o foco, fecham com Esc e devolvem o foco ao gatilho.
- Os campos têm "<label>" associado, asterisco com texto "(obrigatório)" para leitores de tela, "aria-invalid" e erro ligado por "aria-describedby".
- Feedback de mutations e de tempo real em região "aria-live" (polite/assertive) além dos toasts.
- Os estados não dependem só de cor: ícone e texto em erros, "Esgotada" riscada nas edições e rótulos de status no carrinho.
- Imagens de NFT com "alt" descritivo. Imagens decorativas (cards com nome adjacente, banners) usam "alt=""".
- "prefers-reduced-motion" desliga o shimmer e as transições.

12. Desvios do Figma e decisões de UX

- Busca no catálogo desktop: adicionei um campo de busca no topo da sidebar, além do ícone de busca do header, que abre um diálogo. O Figma desktop não tem campo de busca, mas o requisito exige busca.
- Header mobile: mantive um header compacto (logo + busca). No frame mobile, a busca fica dentro da página.
- Hero mobile: usa o texto do desktop ("Seja dono do futuro da arte digital"). O frame mobile diz "da cultura digital".
- Carteiras: a secundária usa uma caixa de seleção ("Igual à carteira principal") no lugar do radio solitário do Figma, para ter semântica de liga/desliga.
- Checkout: o estado da conexão da carteira ("Conectada: 0xA91F…E82C" / "Conectar carteira" / "Desconectar") e o diálogo de revisão não estão desenhados; seguem o mesmo padrão visual.
- Galeria do detalhe: o Figma repete a mesma imagem 4 vezes. Aqui, as vistas 2 a 4 são recortes ampliados (rosto, acessório, textura), com "alt" próprio.
- Ações fora do escopo: Criadores, Aprenda, Diário, Atividade, Ofertas, Downloads e Suporte levam a "/em-breve/:secao", que diz claramente que nada foi executado. Newsletter, login social e "Esqueceu a senha?" exibem aviso, sem simular sucesso. "Ver no Etherscan" abre um "explorador simulado" com a referência, porque um link real cairia em "não encontrado".
- Redes sociais: como a Kurio não tem perfis oficiais, cada ícone do rodapé abre em nova aba a busca por "kurio nft" na rede correspondente (Facebook, Instagram, X/Twitter, LinkedIn e YouTube).
- Toasts no mobile: ficam sobre o header, para não cobrir botões do conteúdo (ex.: "Adicionar" em Carteiras). O mesmo aviso também vai para a região "aria-live".
- Layout do perfil no mobile: o grid usa "minmax(0, 1fr)" para que a lista horizontal de seções não cause overflow em 390 px.
- Avaliações: a aba mostra só o resumo. A leitura de avaliações não faz parte do escopo.
- Contraste: o texto terciário usa "#b39362" apenas sobre "#231611"/"#130c0a" (≥ 4.5:1). O vermelho de erro foi clareado ("#ff8a73") para manter contraste no fundo escuro.
- Assets: as 4 artes vieram do Figma (extraídas dos PDFs) e foram convertidas para WebP em 320/640/960 px. Os ícones de marcas (redes sociais, Google/Facebook) são SVGs próprios, porque o lucide 1.x removeu ícones de marca. A fonte Roboto Mono é auto-hospedada via "@fontsource".

13. Performance (Lighthouse)

Relatórios em "lighthouse/reports/final/"; o histórico de otimização está em "baseline/". Mediana de 3 execuções, build de produção servido com gzip e cenário "default".

Abaixo da meta (Performance mobile 84/88 < 90). Causas identificadas nos relatórios:

1. A camada de mocks está no caminho crítico. São cerca de 116 kB gz (MSW + interceptors + tough-cookie/tldts do MSW + fixtures), e o app só monta depois de "worker.start()", que registra e ativa o Service Worker. Sem isso, as primeiras requisições escapariam da simulação. Com CPU 4x mais lenta (perfil mobile), esse JS adia a renderização.
2. O LCP é de renderização, não de rede. A fase "Load Delay" do LCP é 0 ms (a imagem já chega pré-carregada); cerca de 88% do LCP é "Render Delay": o elemento só existe depois de montar o app e de receber "GET /nfts" e "/featured" com a latência simulada de 120–380 ms.
3. Bundle do app: cerca de 90 kB gz no chunk inicial (axios, tailwind-merge, sonner, Radix).

Otimizações aplicadas (de "baseline/" para "final/"):

- O "main" reserva altura → CLS do detalhe desktop caiu de 0.183 para 0.
- O app baixa em paralelo ao registro do Service Worker.
- O "socket.io-client" é carregado sob demanda.
- O "react-hook-form" e o "zod" saíram do bundle inicial: as rotas importavam "safeRedirect" do módulo do diálogo.
- O preload da imagem LCP usa o mesmo "sizes" do elemento real.
- Imagens WebP responsivas com dimensões fixas; fonte própria com "font-display: swap".

Nenhuma simplificação foi feita só para a auditoria: as imagens, as fontes, os mocks e o realtime são os mesmos da entrega.

Próximos passos: um backend real eliminaria o item 1. Outra opção é pré-renderizar a casca da Home (SSG) e carregar a camada de mocks em idle, com uma fila de requisições já no Service Worker.

14. Limitações percebidas

- O estado simulado é por navegador. Não há sincronização entre dispositivos e o realtime não atravessa abas.
- Hash de senha SHA-256 com sal (mock). Em produção, o correto seria Argon2/bcrypt no servidor.
- As baselines visuais foram geradas em Windows ("*-win32.png"). Em CI Linux, gere-as com "npm run test:e2e:update" no mesmo SO e mantenha-as versionadas.
- O token em "localStorage" é suscetível a XSS (ver §3).
