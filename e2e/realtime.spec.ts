import { ANA, addFromDetail, expect, gotoReady, login, mock, socketReady, test } from './fixtures'

/**
 * Todos os eventos saem do "servidor" simulado e chegam pelo socket.io-client
 * (MSW + @mswjs/socket.io-binding). Nada é injetado no cache ou na UI.
 */
test.describe('Tempo real (Socket.IO)', () => {
  test('preço muda durante o checkout: aviso, resumo atualizado e confirmação bloqueada @mobile', async ({ page }) => {
    await login(page, ANA.email)
    await addFromDetail(page, 'nft-042', 1)
    await gotoReady(page, '/pagamento')
    await expect(page.getByTestId('quote-lines')).toContainText('1.19 ETH')
    await socketReady(page)

    await mock(page, 'nft.setPrice', 'nft-042', '1.50')
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await expect(page.getByTestId('quote-changed')).toContainText('1.19 ETH → 1.50 ETH')
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.50 ETH')

    await page.getByTestId('accept-quote').click()
    await expect(page.getByTestId('confirm-purchase')).toBeEnabled()
  })

  test('servidor recusa cotação desatualizada (409 QUOTE_CHANGED)', async ({ page }) => {
    await login(page, ANA.email)
    await addFromDetail(page, 'nft-042', 1)
    await gotoReady(page, '/pagamento')
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('review-dialog')).toBeVisible()
    // o socket cai antes do evento → a UI não sabe da mudança; o servidor sabe
    await mock(page, 'socket.block', true)
    await mock(page, 'nft.setPrice', 'nft-042', '2.00')
    await page.getByTestId('review-confirm').click()
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    expect(await mock<number>(page, 'orders.count')).toBe(0)
    await mock(page, 'socket.block', false)
  })

  test('item esgota no carrinho e é marcado como indisponível', async ({ page }) => {
    await addFromDetail(page, 'nft-314', 2)
    await socketReady(page)
    await mock(page, 'nft.setAvailability', 'nft-314', 0)
    await expect(page.getByTestId('cart-line').getByTestId('line-status-unavailable')).toBeVisible()
    await expect(page.getByTestId('live-assertive')).toContainText('esgotou')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('0.00 ETH')
  })

  test('eventos duplicados ou antigos não regridem o estado', async ({ page }) => {
    await gotoReady(page, '/mercado')
    await socketReady(page)
    const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' })
    await mock(page, 'nft.setPrice', 'nft-042', '1.50')
    await expect(card).toContainText('1.50 ETH')
    await mock(page, 'nft.setPrice', 'nft-042', '1.60')
    await expect(card).toContainText('1.60 ETH')
    await mock(page, 'socket.replayLast') // duplicata (mesmo eventId)
    await mock(page, 'socket.emitStale', 'nft-042', '0.01') // versão antiga
    await page.waitForTimeout(300)
    await expect(card).toContainText('1.60 ETH')
  })

  test.describe('pedido pendente', () => {
  test.use({ scenario: 'default' }) // pedidos levam 4 s para resolver
  test('desconexão com pedido pendente: retomada sem nova compra após reconectar e recarregar', async ({ page }) => {
    await login(page, ANA.email)
    await addFromDetail(page, 'nft-042', 1)
    await gotoReady(page, '/pagamento')
    await page.getByTestId('confirm-purchase').click()
    await page.getByTestId('review-confirm').click()
    await expect(page.getByTestId('order-status-pending')).toBeVisible()

    // conexão cai enquanto o pedido está pendente; o evento de confirmação se perde
    await mock(page, 'socket.disconnect', 6_000)
    await page.reload()
    await expect(page.getByTestId('order-status-pending')).toBeVisible()
    await expect(page.getByTestId('order-status-confirmed')).toBeVisible({ timeout: 20_000 })
    expect(await mock<number>(page, 'orders.count')).toBe(1)
  })
  })
})
