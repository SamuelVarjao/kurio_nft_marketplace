import { ANA, addFromDetail, expect, gotoReady, login, test } from './fixtures'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh @mobile', async ({ page, isMobile }) => {
    await addFromDetail(page, 'nft-042', 2)
    await addFromDetail(page, 'nft-314', 1)
    const line = isMobile ? 'cart-line-mobile' : 'cart-line'
    await expect(page.getByTestId(line)).toHaveCount(2)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.77 ETH')

    await page.getByRole('button', { name: /Aumentar quantidade de Violet Nomad/ }).filter({ visible: true }).click()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('5.16 ETH')

    // cupom inválido, expirado e válido
    const coupon = page.getByTestId('coupon-input')
    await coupon.fill('NAOEXISTE')
    await coupon.press('Enter')
    await expect(page.getByTestId('coupon-error')).toHaveText('Código promocional inválido.')
    await coupon.fill('VERAO5')
    await coupon.press('Enter')
    await expect(page.getByTestId('coupon-error')).toHaveText('Este código promocional expirou.')
    await coupon.fill('KURIO10')
    await coupon.press('Enter')
    await expect(page.getByTestId('coupon-applied')).toContainText('KURIO10')
    // 10% de 5.16 = 0.516; total = 5.16 - 0.516 + 0.016
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.516 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('4.660 ETH')

    await page.reload()
    await expect(page.getByTestId(line)).toHaveCount(2)
    await expect(page.getByTestId('summary-total')).toHaveText('4.660 ETH')

    await page.getByRole('button', { name: /Remover Violet Nomad/ }).filter({ visible: true }).click()
    await expect(page.getByTestId(line)).toHaveCount(1)
    await page.getByRole('button', { name: /Remover cupom/ }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.00')
  })

  test('itens do visitante são preservados ao autenticar', async ({ page }) => {
    await addFromDetail(page, 'nft-207', 3)
    await login(page, ANA.email, '/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('cart-line')).toContainText('Golden Beat #207')
    await expect(page.getByTestId('cart-line').locator('output')).toHaveText('3')
  })

  test('limite por edição é respeitado', async ({ page }) => {
    await addFromDetail(page, 'nft-042', 10)
    await gotoReady(page, '/nft/nft-042')
    await expect(page.getByTestId('edition-availability')).toContainText('10 já no carrinho')
    await expect(page.getByTestId('buy-button')).toBeDisabled()
  })
})
