/** Configuração versionada da auditoria (ver lighthouse/run.mjs). */
export default {
  port: 4173,
  runs: 3,
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  pages: [
    { id: 'inicio', path: '/' },
    { id: 'detalhe', path: '/nft/nft-042' },
  ],
  profiles: [{ id: 'mobile' }, { id: 'desktop' }],
}
