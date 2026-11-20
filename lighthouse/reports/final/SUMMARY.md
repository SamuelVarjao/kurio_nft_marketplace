# Lighthouse — mediana de 3 execuções

| Página | Perfil | performance | accessibility | best-practices | seo | LCP (ms) | CLS | TBT (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| inicio | mobile | 84 ⚠️ | 100 | 100 | 100 | 3915 | 0.009 | 165 |
| detalhe | mobile | 88 ⚠️ | 100 | 100 | 100 | 3653 | 0 | 118 |
| inicio | desktop | 99 | 100 | 100 | 100 | 927 | 0.003 | 0 |
| detalhe | desktop | 99 | 100 | 100 | 100 | 849 | 0 | 0 |

Metas: performance ≥ 90, accessibility ≥ 95, best-practices ≥ 95, seo ≥ 90

## Ambiente

- **date**: 2026-11-19T13:28:27.155Z
- **node**: v22.12.0
- **os**: Windows_NT 10.0.26200 (x64)
- **cpu**: 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz
- **lighthouse**: 12.8.2
- **chrome**: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36
- **benchmarkIndex**: 2338.5
- **vite**: ^6.3.5
- **server**: serve -s dist (build de produção, gzip)
- **mocks**: MSW ativo, cenário default
- **runsPerPage**: 3
