import type { Page } from '@playwright/test'
import { ANA, addFromDetail, expect, gotoReady, login, mock, test } from './fixtures'

async function prepareCheckout(page: Page, items: [string, number][] = [['nft-042', 2]]) {
  await login(page, ANA.email)
  for (const [id, qty] of items) await addFromDetail(page, id, qty)
  await gotoReady(page, '/pagamento')
  await expect(page.getByTestId('quote-lines')).toBeVisible()
}

async function confirmPurchase(page: Page) {
  await page.getByTestId('confirm-purchase').click()
  await expect(page.getByTestId('review-dialog')).toBeVisible()
  await page.getByTestId('review-confirm').click()
}

test.describe('Pagamento e confirmação', () => {
  test('compra completa do catálogo ao recibo confirmado @mobile', async ({ page }) => {
    await login(page, ANA.email)
    await gotoReady(page, '/mercado')
    await page.getByTestId('nft-card-link').filter({ hasText: 'Emerald Ape #042' }).click()
    await page.getByRole('button', { name: /^Comprar( NFT)?$/ }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.getByTestId('checkout-button').click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByTestId('quote-lines')).toContainText('Emerald Ape #042')
    await confirmPurchase(page)
    await expect(page.getByTestId('order-status-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/pedido\/ord-/)
    await expect(page.getByTestId('receipt-lines')).toContainText('Emerald Ape #042')
    await expect(page.getByTestId('receipt-total')).toHaveText('1.206 ETH')
    await expect(page.getByTestId('tx-hash')).toContainText('0x')
    // apenas os itens comprados saem do carrinho
    await gotoReady(page, '/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('validação dos campos antes da revisão', async ({ page }) => {
    await prepareCheckout(page)
    await page.getByLabel(/^Código de indicação/).fill('!')
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByText('Código deve ter de 4 a 12 letras ou números')).toBeVisible()
    await expect(page.getByTestId('review-dialog')).toBeHidden()
  })

  test('recibo reproduz o snapshot mesmo após mudança no catálogo', async ({ page }) => {
    await prepareCheckout(page)
    await confirmPurchase(page)
    await expect(page.getByTestId('order-status-confirmed')).toBeVisible({ timeout: 15_000 })
    await mock(page, 'nft.setPrice', 'nft-042', '9.99')
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
  })

  test.describe('pagamento recusado', () => {
    test.use({ scenario: 'payment-declined' })
    test('mostra recusa e preserva os itens', async ({ page }) => {
      await prepareCheckout(page)
      await confirmPurchase(page)
      await expect(page.getByTestId('order-status-rejected')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('order-status-rejected')).toContainText('Pagamento recusado pela carteira')
      await gotoReady(page, '/carrinho')
      await expect(page.getByTestId('cart-line')).toHaveCount(1)
    })
  })

  test('cliques repetidos não duplicam o pedido', async ({ page }) => {
    await prepareCheckout(page)
    await page.getByTestId('confirm-purchase').click()
    const confirm = page.getByTestId('review-confirm')
    // cliques em sequência no mesmo botão (o 1º inicia o envio; os demais não criam outro pedido)
    await confirm.click({ clickCount: 3, delay: 20 })
    await confirm.click({ timeout: 500 }).catch(() => undefined)
    await expect(page.getByTestId('order-status-confirmed')).toBeVisible({ timeout: 15_000 })
    expect(await mock<number>(page, 'orders.count')).toBe(1)
  })

  test.describe('timeout após a criação', () => {
    test.use({ scenario: 'order-timeout' })
    test('reenvio com a mesma chave recupera o mesmo pedido', async ({ page }) => {
      await page.clock.install()
      await prepareCheckout(page)
      await confirmPurchase(page)
      // o servidor cria o pedido mas só responde em 12 s; o cliente desiste em 8 s
      await page.clock.fastForward(9_000)
      await expect(page.getByTestId('order-retrying')).toBeVisible()
      await page.clock.fastForward(5_000)
      await expect(page.getByTestId('order-status-confirmed')).toBeVisible({ timeout: 15_000 })
      const orders = await mock<{ key: string }[]>(page, 'orders.list')
      expect(orders).toHaveLength(1)
    })
  })

  test.describe('carteira', () => {
    test.use({ scenario: 'wallet-rejects' })
    test('recusa da conexão impede a revisão', async ({ page }) => {
      await prepareCheckout(page)
      await page.getByTestId('confirm-purchase').click()
      await expect(page.getByTestId('live-assertive')).toContainText('Conexão recusada')
      await expect(page.getByTestId('review-dialog')).toBeHidden()
      await expect(page.getByTestId('wallet-status')).toContainText('não conectada')
    })
  })

  test('desconexão da carteira exige nova conexão', async ({ page }) => {
    await prepareCheckout(page)
    await page.getByTestId('connect-wallet').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await page.getByTestId('wallet-status').getByRole('button', { name: /Desconectar/ }).click()
    await expect(page.getByTestId('wallet-status')).toContainText('não conectada')
  })
})
