import type { Page } from '@playwright/test'
import { ANA, addFromDetail, expect, gotoReady, login, test } from './fixtures'

/**
 * Regressão visual com dados estáveis (cenário `fast`, fixtures
 * determinísticas). Baselines versionadas em e2e/visual.spec.ts-snapshots.
 */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // percorre a página para disparar o carregamento das imagens lazy
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 50))
    }
    window.scrollTo(0, 0)
  })
  // imagens em containers ocultos (display:none) nunca carregam com loading=lazy
  await page.waitForFunction(() => [...document.images].filter((i) => i.getClientRects().length > 0).every((i) => i.complete && i.naturalWidth > 0))
  await page.waitForLoadState('networkidle')
  // toasts são efêmeros e não fazem parte do layout
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' })
}

test.describe('Regressão visual', () => {
  test('início @mobile', async ({ page }) => {
    await gotoReady(page, '/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe @mobile', async ({ page }) => {
    await gotoReady(page, '/nft/nft-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('list', { name: 'NFTs relacionados' }).getByTestId('nft-card').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho @mobile', async ({ page }) => {
    await addFromDetail(page, 'nft-042', 2)
    await addFromDetail(page, 'nft-314', 6)
    await addFromDetail(page, 'nft-088', 9)
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento @mobile', async ({ page }) => {
    await login(page, ANA.email)
    await addFromDetail(page, 'nft-042', 2)
    await addFromDetail(page, 'nft-314', 6)
    await addFromDetail(page, 'nft-088', 9)
    await gotoReady(page, '/pagamento')
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
