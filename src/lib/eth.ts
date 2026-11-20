/**
 * Aritmética decimal para valores em ETH.
 *
 * Valores trafegam como strings decimais ("1.19", "0.016"). Internamente são
 * convertidos para wei (BigInt, 18 casas) — nunca para `number` — para manter
 * precisão em somas, multiplicações por quantidade e percentuais.
 */
export const ETH_DECIMALS = 18
const SCALE = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export type EthString = string

export function isEthString(value: unknown): value is EthString {
  return typeof value === 'string' && DECIMAL_RE.test(value)
}

export function toWei(value: EthString): bigint {
  if (!isEthString(value)) throw new Error(`Valor ETH inválido: ${String(value)}`)
  const negative = value.startsWith('-')
  const [int, frac = ''] = (negative ? value.slice(1) : value).split('.')
  if (frac.length > ETH_DECIMALS) throw new Error(`Precisão excedida: ${value}`)
  const wei = BigInt(int) * SCALE + BigInt(frac.padEnd(ETH_DECIMALS, '0') || '0')
  return negative ? -wei : wei
}

/** Converte wei para string decimal canônica (sem zeros à direita). */
export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...values: EthString[]): EthString {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: EthString, quantity: number): EthString {
  if (!Number.isInteger(quantity)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Percentual em pontos-base (1000 = 10%), arredondando para baixo em wei. */
export function percentEth(value: EthString, basisPoints: number): EthString {
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}

export function maxEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) >= 0 ? a : b
}

/**
 * Formata para apresentação. Mantém no mínimo `minFraction` casas e não
 * arredonda casas significativas (até `maxFraction`) — o total exibido é o
 * mesmo que a API calculou.
 */
export function formatEth(
  value: EthString,
  { minFraction = 2, maxFraction = 6, unit = true }: { minFraction?: number; maxFraction?: number; unit?: boolean } = {},
): string {
  const canonical = fromWei(toWei(value))
  const negative = canonical.startsWith('-')
  const [int, frac = ''] = (negative ? canonical.slice(1) : canonical).split('.')
  let f = frac.slice(0, maxFraction)
  if (frac.length > maxFraction) {
    // truncamento explícito, sinalizado com "…" para não esconder precisão
    f = `${f}…`
  }
  f = f.padEnd(minFraction, '0')
  const out = `${negative ? '-' : ''}${int}${f ? `.${f}` : ''}`
  return unit ? `${out} ETH` : out
}
