import { expect, gotoReady, mock, test } from './fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto e navegação a partir do catálogo @mobile', async ({ page }) => {
    await gotoReady(page, '/nft/nft-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('detail-price')).toContainText('1.19 ETH')
    await expect(page).toHaveTitle(/Emerald Ape #042/)
    await gotoReady(page, '/')
    await page.getByTestId('nft-card-link').filter({ hasText: 'Sage Nomad' }).click()
    await expect(page).toHaveURL(/\/nft\/nft-009/)
  })

  test('NFT inexistente e rota inexistente mostram 404', async ({ page }) => {
    await gotoReady(page, '/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await gotoReady(page, '/rota/qualquer')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição indisponível e limite de quantidade', async ({ page }) => {
    await gotoReady(page, '/nft/nft-042')
    // esgota a edição 1/10 no servidor → evento atualiza o detalhe
    await mock(page, 'nft.setAvailability', 'nft-042', 0, '1/10')
    await expect(page.getByTestId('edition-1/10')).toHaveAttribute('aria-disabled', 'true')
    // limite: 1/50 tem máx. 10 por pedido
    const inc = page.getByRole('button', { name: /^Aumentar quantidade/ }).filter({ visible: true }).first()
    for (let i = 0; i < 12; i++) if (await inc.isEnabled()) await inc.click()
    await expect(page.getByRole('group', { name: 'Emerald Ape #042' }).first().locator('output')).toHaveText('10')
    await expect(inc).toBeDisabled()
  })
})
