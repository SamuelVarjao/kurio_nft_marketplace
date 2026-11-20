import { ANA, expect, gotoReady, login, mock, test } from './fixtures'

test.describe('Favoritos', () => {
  test('persistem para o usuário autenticado', async ({ page }) => {
    await login(page, ANA.email, '/nft/nft-009')
    const fav = page.getByTestId('detail-favorite')
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByTestId('detail-favorite')).toHaveAttribute('aria-pressed', 'true')
  })

  test('falha da mutation faz rollback do estado otimista e recupera', async ({ page }) => {
    await login(page, ANA.email, '/nft/nft-009')
    await expect(page.getByTestId('detail-favorite')).toBeVisible()
    await mock(page, 'setScenario', 'favorites-fail')
    const fav = page.getByTestId('detail-favorite')
    await fav.click()
    await expect(page.getByTestId('live-assertive')).toContainText('Não foi possível favoritar')
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await mock(page, 'setScenario', 'fast')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
  })

  test('visitante é levado ao login', async ({ page }) => {
    await gotoReady(page, '/nft/nft-009')
    await page.getByTestId('detail-favorite').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fnft-009/)
  })
})
