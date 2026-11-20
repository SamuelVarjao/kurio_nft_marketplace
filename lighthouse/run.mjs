/**
 * Auditoria Lighthouse reprodutível.
 *
 * - Build otimizado (`npm run build`) servido por `serve -s dist` com gzip (porta 4173)
 * - Cenário padrão dos mocks (MSW ativo, latência 120–380 ms)
 * - Páginas: Início (/) e Detalhe (/nft/nft-042)
 * - Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento, CPU 4x) e desktop
 * - 3 medições por página e perfil; reporta a mediana de cada categoria
 *
 * Uso: npm run build && npm run lighthouse
 * Saída: lighthouse/reports/<data>/ (HTML + JSON por execução, summary.json, SUMMARY.md)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'
import config from './lighthouse.config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const outDir = path.join(root, 'lighthouse', 'reports', process.env.LH_OUT ?? stamp)

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu: ${url}`)
}

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  // `serve` comprime (gzip) como a CDN do deploy; rewrites de SPA com -s
  const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['serve', '-s', 'dist', '-l', String(config.port), '--no-clipboard'], {
    cwd: root,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  const base = `http://localhost:${config.port}`
  try {
    await waitFor(base)
    // CHROME_PATH > Chrome instalado (chrome-launcher) > Chromium do Playwright
    const chromePath = process.env.CHROME_PATH || (chromeLauncher.Launcher.getInstallations()[0] ?? chromium.executablePath())
    console.log(`Chrome: ${chromePath}`)
    const results = []
    for (const profile of config.profiles) {
      for (const page of config.pages) {
        const runs = []
        for (let i = 1; i <= config.runs; i++) {
          // perfil de navegador novo a cada execução (sem cache/SW prévio)
          const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
          try {
            const result = await lighthouse(
              `${base}${page.path}`,
              { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: config.categories },
              profile.id === 'desktop' ? desktopConfig : undefined,
            )
            const lhr = result.lhr
            const name = `${page.id}-${profile.id}-run${i}`
            await fs.writeFile(path.join(outDir, `${name}.html`), result.report[0])
            await fs.writeFile(path.join(outDir, `${name}.json`), result.report[1])
            const run = {
              scores: Object.fromEntries(config.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
              lcp: lhr.audits['largest-contentful-paint'].numericValue,
              cls: lhr.audits['cumulative-layout-shift'].numericValue,
              tbt: lhr.audits['total-blocking-time'].numericValue,
              fcp: lhr.audits['first-contentful-paint'].numericValue,
            }
            runs.push(run)
            console.log(`${name}:`, run.scores, `LCP ${Math.round(run.lcp)}ms CLS ${run.cls.toFixed(3)} TBT ${Math.round(run.tbt)}ms`)
            if (!results.env) results.env = { lighthouse: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent, benchmarkIndex: lhr.environment.benchmarkIndex }
          } finally {
            await chrome.kill()
          }
        }
        results.push({
          page: page.id,
          url: page.path,
          profile: profile.id,
          median: {
            ...Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            lcpMs: Math.round(median(runs.map((r) => r.lcp))),
            cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
            tbtMs: Math.round(median(runs.map((r) => r.tbt))),
            fcpMs: Math.round(median(runs.map((r) => r.fcp))),
          },
          runs,
        })
      }
    }
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
    const environment = {
      date: new Date().toISOString(),
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model,
      lighthouse: results.env?.lighthouse,
      chrome: results.env?.userAgent,
      benchmarkIndex: results.env?.benchmarkIndex,
      vite: pkg.devDependencies.vite,
      server: 'serve -s dist (build de produção, gzip)',
      mocks: 'MSW ativo, cenário default',
      runsPerPage: config.runs,
    }
    await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify({ environment, targets: config.targets, results }, null, 2))
    const rows = results
      .map(
        (r) =>
          `| ${r.page} | ${r.profile} | ${config.categories.map((c) => `${r.median[c]}${r.median[c] < config.targets[c] ? ' ⚠️' : ''}`).join(' | ')} | ${r.median.lcpMs} | ${r.median.cls} | ${r.median.tbtMs} |`,
      )
      .join('\n')
    const md = `# Lighthouse — mediana de ${config.runs} execuções\n\n| Página | Perfil | ${config.categories.join(' | ')} | LCP (ms) | CLS | TBT (ms) |\n|---|---|${config.categories.map(() => '---:').join('|')}|---:|---:|---:|\n${rows}\n\nMetas: ${Object.entries(config.targets).map(([k, v]) => `${k} ≥ ${v}`).join(', ')}\n\n## Ambiente\n\n${Object.entries(environment).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}\n`
    await fs.writeFile(path.join(outDir, 'SUMMARY.md'), md)
    console.log(`\n${md}\nRelatórios em ${path.relative(root, outDir)}`)
  } finally {
    server.kill()
    if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
