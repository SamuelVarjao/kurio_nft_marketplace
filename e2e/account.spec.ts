import { ANA, BRUNO, expect, login, PASSWORD, test } from './fixtures'

// PNG 1x1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil e carteiras', () => {
  test('edição de perfil com validação, conflito e persistência', async ({ page }) => {
    await login(page, ANA.email, '/perfil')
    const name = page.getByLabel(/^Nome de exibição/)
    await name.fill('A')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Use pelo menos 2 caracteres').first()).toBeVisible()

    await name.fill('Ana Atualizada')
    await page.getByLabel(/^Nome de usuário/).fill('bruno') // pertence a outro usuário
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await page.getByLabel(/^Nome de usuário/).fill('ana.nova')
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('live-polite')).toContainText('Perfil atualizado')
    await page.reload()
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue('Ana Atualizada')
  })

  test('avatar e alteração de senha', async ({ page }) => {
    await login(page, ANA.email, '/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('avatar-img')).toHaveCount(0)

    await page.getByLabel('Senha atual').fill('senhaerrada1')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha2027')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2027')
    await page.getByTestId('profile-save').click()
    await expect(page.locator('#conteudo').getByRole('alert').filter({ hasText: 'Senha atual incorreta' })).toBeVisible()
    await page.getByLabel('Senha atual').fill(PASSWORD)
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('live-polite')).toContainText('Senha alterada')
  })

  test('cadastro e edição de carteiras principal e secundária @mobile', async ({ page }) => {
    await login(page, BRUNO.email, '/perfil/carteiras')
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    const form = page.getByTestId('wallet-form-primary')
    await form.getByTestId('wallet-save-primary').click()
    await expect(form.getByRole('alert').filter({ hasText: 'Selecione uma rede' })).toBeVisible()
    await expect(form.getByLabel(/^Endereço da carteira/)).toHaveAttribute('aria-invalid', 'true')

    await form.getByLabel(/^Nome de exibição/).fill('Bruno Nômade')
    await form.getByLabel(/^Apelido da carteira/).fill('Principal')
    await form.getByLabel(/^Rede/).selectOption('polygon')
    await form.getByLabel(/^Nome do perfil/).fill('bruno.nomad')
    await form.getByLabel(/^Endereço da carteira/).fill('0x123')
    await form.getByLabel(/^Tipo de carteira/).selectOption('walletconnect')
    await form.getByLabel(/^Código de indicação/).fill('BRUNO1')
    await form.getByLabel(/^E-mail/).fill('bruno@kurio.test')
    await form.getByLabel(/^Nome ENS/).fill('bruno-nomad')
    await form.getByTestId('wallet-save-primary').click()
    await expect(form.getByText(/Endereço deve começar com 0x/)).toBeVisible()
    await form.getByLabel(/^Endereço da carteira/).fill('0x' + 'ab'.repeat(20))
    await form.getByTestId('wallet-save-primary').click()
    await expect(page.getByTestId('live-polite')).toContainText('Carteira salva')

    await page.getByLabel('Igual à carteira principal').click()
    await expect(page.getByText('A carteira secundária usa os mesmos dados da principal.')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('wallet-form-primary').getByLabel(/^Rede/)).toHaveValue('polygon')
    await expect(page.getByLabel('Igual à carteira principal')).toBeChecked()
  })
})
