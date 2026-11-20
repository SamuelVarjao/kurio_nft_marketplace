/** Aceita apenas caminhos internos (evita open redirect). */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/entrar') &&
    !value.startsWith('/cadastro')
    ? value
    : undefined
}
