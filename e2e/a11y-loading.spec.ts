import { ANA, expect, gotoReady, login, mock, test } from './fixtures'

test.describe('Acessibilidade', () => {
  test('skip link, foco visível e navegação por teclado', async ({ page }) => {
    await gotoReady(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)
    // links do catálogo alcançáveis pelo teclado
    const first = page.getByTestId('nft-card-link').first()
    await first.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
  })

  test('diálogo prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
    await gotoReady(page, '/')
    const trigger = page.getByRole('button', { name: 'Buscar', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('busca pelo diálogo leva ao mercado com a consulta na URL', async ({ page }) => {
    await gotoReady(page, '/')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page.getByLabel('Termo de busca').fill('nomad')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/mercado\?q=nomad/)
  })
})

test.describe('Carregamento, falhas e recuperação', () => {
  test.describe('rede lenta', () => {
    test.use({ scenario: 'slow' })
    test('skeletons com shimmer no catálogo, detalhe e resumo do carrinho @mobile', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
      await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 10_000 })
      await page.goto('/nft/nft-042')
      await expect(page.getByTestId('detail-skeleton')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 10_000 })
      await page.goto('/carrinho')
      await expect(page.getByTestId('summary-skeleton')).toBeVisible()
    })
  })

  test.describe('erro 500 transitório', () => {
    test.use({ scenario: 'server-error' })
    test('feedback de falha e recuperação após nova tentativa', async ({ page }) => {
      await gotoReady(page, '/mercado')
      await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
    })
  })

  test.describe('sem conexão', () => {
    test.use({ scenario: 'offline' })
    test('indica falta de conexão e recupera quando a rede volta', async ({ page }) => {
      await gotoReady(page, '/nft/nft-042')
      await expect(page.getByRole('heading', { name: 'Sem conexão' })).toBeVisible({ timeout: 10_000 })
      await mock(page, 'setScenario', 'fast')
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    })
  })
})

test.describe('Responsividade', () => {
  for (const width of [390, 768, 1440]) {
    test(`sem overflow horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await login(page, ANA.email)
      for (const url of ['/', '/mercado', '/nft/nft-042', '/carrinho', '/pagamento', '/perfil', '/perfil/carteiras', '/perfil/favoritos']) {
        await gotoReady(page, url)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${url} @ ${width}px`).toBeLessThanOrEqual(0)
      }
    })
  }
})
