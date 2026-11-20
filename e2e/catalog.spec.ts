import { expect, gotoReady, test } from './fixtures'

test.describe('Catálogo: busca, filtros, ordenação e paginação', () => {
  test('filtros combinados, ordenação e paginação compõem a URL e reiniciam a página @mobile', async ({ page, isMobile }) => {
    await gotoReady(page, '/mercado')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)

    // paginação
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)

    // filtro reinicia a paginação
    if (isMobile) await page.getByRole('button', { name: 'Abrir filtros' }).click()
    const filters = page.getByTestId('catalog-filters').filter({ visible: true })
    await filters.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page).toHaveURL(/cat=musica/)
    await filters.getByRole('button', { name: /^Polygon/ }).click()
    await expect(page).toHaveURL(/net=polygon/)
    if (isMobile) await page.keyboard.press('Escape')

    // resultados refletem os parâmetros enviados à API
    const status = page.getByTestId('catalog-status')
    await expect(status).toContainText('resultado')
    const names = await grid.getByTestId('nft-card').allTextContents()
    expect(names.some((n) => n.includes('Golden Frequency #071'))).toBe(true)

    // ordenação
    await page.getByTestId('catalog-sort').click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price_asc/)
    const prices = await grid.locator('[data-testid=nft-card] .text-primary').allTextContents()
    const nums = prices.map((p) => Number(p.replace(/[^\d.]/g, '')))
    expect([...nums].sort((a, b) => a - b)).toEqual(nums)

    // sobrevive a refresh
    await page.reload()
    await expect(page).toHaveURL(/cat=musica.*net=polygon.*sort=price_asc|sort=price_asc/)
    await expect(page.getByTestId('catalog-sort')).toContainText('Menor preço')

    // histórico: voltar desfaz a ordenação, depois o filtro de rede
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await page.goBack()
    await expect(page).not.toHaveURL(/net=/)
    await expect(page).toHaveURL(/cat=musica/)
  })

  test('busca por texto e estado vazio', async ({ page }) => {
    await gotoReady(page, '/mercado')
    await page.getByTestId('catalog-search').fill('signal')
    await page.getByTestId('catalog-search').press('Enter')
    await expect(page).toHaveURL(/q=signal/)
    await expect(page.getByTestId('catalog-grid').getByRole('heading').first()).toBeVisible()
    for (const t of await page.getByTestId('catalog-grid').getByRole('heading').allTextContents()) expect(t.toLowerCase()).toContain('signal')
    await page.getByTestId('catalog-search').fill('inexistente-xyz')
    await page.getByTestId('catalog-search').press('Enter')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
  })

  test.describe('respostas fora de ordem', () => {
    test.use({ scenario: 'variable-latency' })
    test('a resposta lenta da consulta anterior não sobrescreve a atual', async ({ page }) => {
      await gotoReady(page, '/mercado')
      await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 10_000 })
      // 1ª troca → lenta (1.6 s); 2ª troca → rápida (150 ms)
      await page.getByTestId('catalog-filters').getByRole('button', { name: /^Fotografia/ }).click()
      await page.getByTestId('catalog-filters').getByRole('button', { name: /^Fotografia/ }).click()
      await page.getByTestId('catalog-filters').getByRole('button', { name: /^Jogos/ }).click()
      await expect(page).toHaveURL(/cat=jogos$/)
      await page.waitForTimeout(2_000)
      const status = await page.getByTestId('catalog-status').textContent()
      const jogosCount = await page.getByTestId('catalog-filters').getByRole('button', { name: /^Jogos/ }).textContent()
      expect(status).toContain(jogosCount!.match(/\((\d+)\)/)![1])
    })
  })

  test.describe('catálogo vazio', () => {
    test.use({ scenario: 'empty' })
    test('mostra estado vazio', async ({ page }) => {
      await gotoReady(page, '/mercado')
      await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    })
  })
})
