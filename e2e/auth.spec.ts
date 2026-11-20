import { ANA, BRUNO, expect, gotoReady, login, mock, PASSWORD, test } from './fixtures'

test.describe('Conta e sessão', () => {
  test('cadastro com validação, conflito e sucesso @mobile', async ({ page }) => {
    await gotoReady(page, '/cadastro')
    const d = page.getByRole('dialog')
    await d.getByRole('button', { name: 'Criar conta' }).click()
    await expect(d.getByText('Use pelo menos 3 caracteres')).toBeVisible()
    const username = d.getByPlaceholder('Nome de usuário')
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    // mensagem de erro associada ao campo
    const describedBy = await username.getAttribute('aria-describedby')
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText('3 caracteres')

    await username.fill('nova_colecionadora')
    await d.getByPlaceholder('Digite seu e-mail').fill(ANA.email) // conflito
    await d.getByPlaceholder('Senha', { exact: true }).fill('Senha1234')
    await d.getByPlaceholder('Confirmar senha').fill('Senha1234')
    await d.getByRole('button', { name: 'Criar conta' }).click()
    await expect(d.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    await d.getByPlaceholder('Digite seu e-mail').fill('nova@kurio.test')
    await d.getByRole('button', { name: 'Criar conta' }).click()
    await expect(d).toBeHidden()
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kurio:session') ?? '{}').user?.email))
      .toBe('nova@kurio.test')
    // a senha nunca é armazenada em claro no servidor simulado
    const stored = await page.evaluate(() => localStorage.getItem('kurio:mock-db:v1') ?? '')
    expect(stored).not.toContain('Senha1234')
  })

  test('login inválido e retorno ao fluxo anterior', async ({ page }) => {
    await gotoReady(page, '/entrar?redirect=/perfil/carteiras')
    const d = page.getByRole('dialog')
    await d.getByPlaceholder('E-mail').fill(ANA.email)
    await d.getByPlaceholder('Senha', { exact: true }).fill('errada123')
    await d.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(d.getByTestId('login-error')).toHaveText('E-mail ou senha incorretos.')
    await d.getByPlaceholder('Senha', { exact: true }).fill(PASSWORD)
    await d.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('rota privada exige login e a sessão sobrevive a refresh', async ({ page }) => {
    await gotoReady(page, '/perfil')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil/)
    await login(page, ANA.email, '/perfil')
    await expect(page).toHaveURL(/\/perfil$/)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('expiração durante a navegação preserva o contexto', async ({ page }) => {
    await login(page, ANA.email, '/perfil/carteiras')
    await mock(page, 'session.expireAll')
    await page.getByRole('link', { name: 'Dados do perfil' }).click()
    await expect(page).toHaveURL(/\/entrar\?.*reason=expired/)
    await expect(page.getByTestId('session-expired-notice')).toBeVisible()
    const d = page.getByRole('dialog')
    await d.getByPlaceholder('E-mail').fill(ANA.email)
    await d.getByPlaceholder('Senha', { exact: true }).fill(PASSWORD)
    await d.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil/)
  })

  test('logout e troca de usuário limpam dados privados', async ({ page }) => {
    await login(page, ANA.email, '/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').getByTestId('nft-card')).toHaveCount(2)
    await page.getByTestId('user-menu').click()
    await page.getByTestId('logout').click()
    await expect(page.getByTestId('header-login')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('kurio:session'))).toBeNull()

    await login(page, BRUNO.email, '/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Nenhum favorito ainda' })).toBeVisible()
    // evento de pedido de outro usuário (sessão anterior) é descartado pelo cliente
    await mock(page, 'socket.emitForeignOrder', 'usr-ana')
    await page.waitForTimeout(300)
    await expect(page.getByText('Pagamento confirmado')).toHaveCount(0)
  })
})
