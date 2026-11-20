Desafio frontend Kurio NFT Marketplace para a empresa Jungle Gaming desenvolvido por Samuel Varjão em React + TypeScript, com APIs, sessão, carteiras, pagamentos e tempo real simulados na camada de rede (MSW + Socket.IO).

- Demo publicada: <https://kurionftmarketplace.vercel.app/>
- Repositório: <https://github.com/SamuelVarjao/kurio_nft_marketplace>

> Decisões, contratos, política de sessão e cache, reconciliação REST ↔ Socket.IO, limitações e desvios do Figma estão em ARCHITECTURE.md.

Stack

React 19 · TypeScript · Vite 6 · TanStack Router (file-based) · TanStack Query 5 · Axios · Socket.IO client · Tailwind CSS 4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · Playwright · Lighthouse · zod · react-hook-form

Setup

Requer Node ≥ 20.

1. Instale as dependências:

```powershell
npm ci
```

2. Rode em modo de desenvolvimento:

```powershell
npm run dev
```

3. Abra <http://localhost:5173>. Os mocks já vêm ativos: não há backend a configurar.

Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (MSW) e HMR |
| `npm run build` | Typecheck (`tsc -b`) e build de produção em `dist/` (mocks incluídos) |
| `npm run preview` | Serve o build em <http://localhost:4173> |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (faz o build e sobe o preview automaticamente) |
| `npm run test:e2e:update` | Regenera as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`) |
| `npm run lighthouse` | Auditoria Lighthouse (rode `npm run build` antes) |

Na primeira execução dos testes, instale o navegador:

```powershell
npx playwright install chromium
```

Testes

Os testes fazem login com os usuários fictícios, mas a senha não fica no código. Crie um arquivo `.env.e2e.local` na raiz com a senha da seção:

```text
E2E_PASSWORD=<senha fictícia>
```

Também é possível defini-la só na sessão do terminal (`$env:E2E_PASSWORD = '…'` no PowerShell).

Variáveis de ambiente

Copie `.env.example` para `.env.local` se quiser alterar algo. Todas são opcionais.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). `false` exige um backend real |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial (ver tabela abaixo) |
| `VITE_API_URL` | `/api` | Base da API REST |
| `VITE_SOCKET_URL` | `https://realtime.kurio.test` | Host do Socket.IO (interceptado pelo MSW em modo demo) |

Credenciais fictícias

Senha de todos os usuários: `Kurio2026!` (o servidor simulado guarda apenas o hash com sal).

| Usuário | E-mail | Estado inicial |
| --- | --- | --- |
| Ana Colecionadora | `ana@kurio.test` | 2 favoritos, carteiras principal (MetaMask/Ethereum) e secundária (Coinbase/Polygon) |
| Bruno Nômade | `bruno@kurio.test` | Sem favoritos e sem carteiras (bom para testar cadastro de carteira) |

Cupons: `KURIO10` (10%) e `GENESIS25` (25%) são válidos; `VERAO5` está expirado; qualquer outro código é inválido.

Cenários simulados

O site não tem nenhuma interface de mocks: o desafio não pede uma, e ela não faria parte do produto. Há três formas de selecionar um cenário:

1. Pela URL, por exemplo <https://kurionftmarketplace.vercel.app/?scenario=payment-declined>. A escolha fica salva para os próximos carregamentos.
2. Pelo console do navegador: `__KURIO_MOCKS__.setScenario('slow')`.
3. No build: `VITE_MOCK_SCENARIO`.

| Cenário | Efeito |
| --- | --- |
| `default` | Sucesso com latência de 120 a 380 ms (determinística) |
| `fast` | Sem latência (usado nos testes e na regressão visual) |
| `empty` | Catálogo sempre vazio |
| `slow` | 2,5 s por requisição → skeletons |
| `variable-latency` | Respostas do catálogo alternam entre 1,6 s e 150 ms → chegam fora de ordem |
| `offline` | Toda requisição falha com erro de rede; o socket não conecta |
| `server-error` | Catálogo e detalhe respondem 500 nas 3 primeiras tentativas e depois se recuperam |
| `unavailable` | Catálogo responde 503 sempre |
| `forbidden` | Perfil e carteiras respondem 403 |
| `session-expired` | A sessão expira 45 s após o login |
| `favorites-fail` | Favoritar/desfavoritar responde 500 → rollback otimista |
| `price-change` | 3 s após a cotação, o 1º item do carrinho sobe 0.10 ETH (via `nft.updated`) |
| `sold-out` | 3 s após a cotação, a edição do 1º item esgota (via `nft.updated`) |
| `order-timeout` | O pedido é criado, mas a 1ª resposta chega depois do timeout do cliente (8 s) |
| `payment-declined` | Os pedidos terminam recusados |
| `wallet-rejects` | A carteira recusa a conexão |

Reset

No console do navegador:

- `__KURIO_MOCKS__.resetAll()` restaura integralmente as fixtures (catálogo, usuários, carrinhos, pedidos e contadores), apaga a sessão, o carrinho do visitante e as tentativas de checkout guardados no navegador e recarrega a página. O cenário escolhido é mantido.
- `__KURIO_MOCKS__.reset()` restaura só o servidor simulado, sem recarregar (é o que os testes usam).

API de controle (`window.__KURIO_MOCKS__`)

Disponível quando os mocks estão ativos. É usada pelo Playwright e pode ser chamada pelo console. As ações acontecem no servidor simulado e chegam ao app pelas vias reais: REST via MSW e eventos via `socket.io-client`.

```js
__KURIO_MOCKS__.nft.setPrice('nft-042', '1.50')          // emite nft.updated
__KURIO_MOCKS__.nft.setAvailability('nft-314', 0)         // esgota a edição 1/50
__KURIO_MOCKS__.socket.replayLast()                       // duplicata (mesmo eventId)
__KURIO_MOCKS__.socket.emitStale('nft-042', '0.01')       // evento com versão antiga
__KURIO_MOCKS__.socket.disconnect(5000)                   // derruba o socket por 5 s
__KURIO_MOCKS__.session.expireAll()                       // próxima chamada → 401 SESSION_EXPIRED
__KURIO_MOCKS__.failNext('catalog', 500)                  // falha pontual
__KURIO_MOCKS__.orders.list()
```


Testes (Playwright)

```powershell
npm run test:e2e
```

- Projetos: `desktop-chromium` (1440×900, todos os testes) e `mobile-chromium` (390×844, testes marcados `@mobile`: fluxos principais e regressão visual).
- Isolamento: cada teste roda em um contexto novo (banco simulado, sessão e carrinho próprios) com o cenário definido no próprio teste.
- Tempo e eventos: `page.clock` controla o tempo nos cenários sensíveis (timeout do pedido). Os eventos são disparados por `window.__KURIO_MOCKS__`, nunca pela UI.
- Relatório: HTML em `playwright-report/`. Traces, vídeos e screenshots das falhas ficam em `test-results/`.
- Regressão visual: Início, Detalhe, Carrinho e Pagamento em desktop e mobile, com baselines versionadas em `e2e/visual.spec.ts-snapshots/`.

| Arquivo | Cobertura |
| --- | --- |
| `catalog.spec.ts` | Busca, filtros combinados, ordenação, paginação, refresh e histórico; vazio; fora de ordem |
| `detail.spec.ts` | Acesso direto, 404 de NFT e de rota, edição esgotada, limite de quantidade |
| `auth.spec.ts` | Cadastro (validação/conflito), login, retorno ao fluxo, expiração, logout e troca de usuário |
| `favorites.spec.ts` | Persistência, falha da mutation com rollback e recuperação |
| `cart.spec.ts` | Quantidades, remoção, cupom (inválido/expirado/válido), refresh, merge no login, limite |
| `checkout.spec.ts` | Compra completa até o recibo, validação, snapshot do recibo, recusa, clique repetido, timeout com idempotência, carteira |
| `realtime.spec.ts` | Preço muda no checkout, 409 de cotação, esgotado no carrinho, duplicatas/eventos antigos, desconexão com pedido pendente |
| `account.spec.ts` | Perfil (validação/conflito), avatar, senha, carteiras principal e secundária |
| `a11y-loading.spec.ts` | Teclado e skip link, foco em diálogos, skeletons, erro 500/offline e recuperação, overflow em 390/768/1440 |
| `visual.spec.ts` | Regressão visual |

Auditoria Lighthouse


- Configuração versionada: `lighthouse/lighthouse.config.mjs` (páginas, perfis, 3 execuções, metas) e `lighthouse/run.mjs`.
- Condições: build de produção servido com gzip (`serve -s dist`), cenário `default` dos mocks, perfil novo do Chrome por execução, perfis mobile (padrão do Lighthouse) e desktop.
- Saída: `lighthouse/reports/<data>/`, com HTML e JSON por execução, `summary.json` e `SUMMARY.md` (medianas, LCP/CLS/TBT, versões e ambiente).
- Navegador: usa o Chrome instalado; sem ele, o Chromium do Playwright. Para forçar outro, defina `CHROME_PATH`.

Os resultados atuais e a análise das causas estão em [ARCHITECTURE.md § 12](./ARCHITECTURE.md#12-performance-lighthouse).

Deploy

O deploy é na Vercel (`vercel.json`): framework Vite, `npm run build`, rewrites de SPA (acesso direto e refresh em qualquer rota) e o `mockServiceWorker.js` servido sem cache. Os mocks e o realtime funcionam no ambiente publicado.

- Repositório: <https://github.com/SamuelVarjao/kurio_nft_marketplace>
- URL pública: <https://kurionftmarketplace.vercel.app/>
