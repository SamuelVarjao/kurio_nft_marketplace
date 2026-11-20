import { test as base, expect, type Page } from '@playwright/test'

export const PASSWORD = 'Kurio2026!'
export const ANA = { email: 'ana@kurio.test', name: 'Ana Colecionadora' }
export const BRUNO = { email: 'bruno@kurio.test', name: 'Bruno Nômade' }

type Options = { scenario: string }

/**
 * - Cenário escolhido por teste (`test.use({ scenario })`), aplicado antes do
 *   app carregar via localStorage — mesma via do `?scenario=` da demo.
 * - Contexto novo por teste = banco simulado, sessão e carrinho isolados.
 */
export const test = base.extend<Options>({
  scenario: ['fast', { option: true }],
  page: async ({ page, scenario }, use) => {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('__e2e_init')) {
        localStorage.setItem('kurio:mock-scenario', s)
        localStorage.setItem('kurio:mock-panel', 'hidden')
        sessionStorage.setItem('__e2e_init', '1')
      }
    }, scenario)
    await use(page)
  },
})

export { expect }

/** Chama a API de controle dos mocks (servidor simulado), sem passar pela UI. */
export async function mock<T = unknown>(page: Page, path: string, ...args: unknown[]): Promise<T> {
  await page.waitForFunction(() => Boolean(window.__KURIO_MOCKS__))
  return page.evaluate(
    ([p, a]) => {
      const parts = (p as string).split('.')
      let target: unknown = window.__KURIO_MOCKS__
      let owner: unknown = null
      for (const key of parts) {
        owner = target
        target = (target as Record<string, unknown>)[key]
      }
      return (target as (...x: unknown[]) => unknown).apply(owner, a as unknown[])
    },
    [path, args] as const,
  ) as Promise<T>
}

export async function gotoReady(page: Page, url: string) {
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__KURIO_MOCKS__))
  await expect(page.locator('#conteudo')).toBeAttached()
}

export async function login(page: Page, email = ANA.email, redirect?: string) {
  await gotoReady(page, redirect ? `/entrar?redirect=${encodeURIComponent(redirect)}` : '/entrar')
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('E-mail').fill(email)
  await dialog.getByPlaceholder('Senha', { exact: true }).fill(PASSWORD)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('kurio:session')))).toBe(true)
}

export async function socketReady(page: Page) {
  await expect.poll(() => mock<unknown[]>(page, 'socket.connections').then((c) => c.length)).toBeGreaterThan(0)
}

/** Adiciona um NFT ao carrinho pelo detalhe. */
export async function addFromDetail(page: Page, nftId: string, quantity = 1) {
  await gotoReady(page, `/nft/${nftId}`)
  const inc = page.getByRole('button', { name: /^Aumentar quantidade/ }).filter({ visible: true }).first()
  for (let i = 1; i < quantity; i++) await inc.click()
  await page.getByRole('button', { name: /^Comprar( NFT)?$/ }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/carrinho$/)
}
