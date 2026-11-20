import { useEffect, useState } from 'react'
import type { CatalogResponse } from '@/contracts'
import { CATEGORIES, NETWORKS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { fromWei, toWei } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { toggleCsv, type CatalogSearch } from '../search'

const CENT = 10n ** 16n // 0.01 ETH
const toCents = (eth: string) => Number(toWei(eth) / CENT)
const fromCents = (cents: number) => fromWei(BigInt(cents) * CENT)
const fmt = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CatalogFilters({
  search,
  facets,
  onChange,
  idPrefix = 'f',
}: {
  search: CatalogSearch
  facets: CatalogResponse['facets'] | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix?: string
}) {
  const selectedCats = new Set(search.cat?.split(',') ?? [])
  const selectedNets = new Set(search.net?.split(',') ?? [])
  const bounds = facets ? [toCents(facets.priceRange.min), Math.max(toCents(facets.priceRange.max), toCents(facets.priceRange.min) + 1)] : [2, 1230]
  const [range, setRange] = useState<number[]>([search.min ? toCents(search.min) : bounds[0], search.max ? toCents(search.max) : bounds[1]])

  useEffect(() => {
    setRange([search.min ? toCents(search.min) : bounds[0], search.max ? toCents(search.max) : bounds[1]])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.min, search.max, bounds[0], bounds[1]])

  const itemCls = (active: boolean) =>
    cn(
      'flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors hover:text-primary',
      active ? 'bg-primary/15 font-bold text-primary' : 'text-muted-foreground',
    )

  return (
    <div className="flex flex-col gap-8 bg-card p-5" data-testid="catalog-filters">
      <section aria-labelledby={`${idPrefix}-cat`}>
        <h2 id={`${idPrefix}-cat`} className="mb-3 text-base font-bold">
          Coleções
        </h2>
        <ul className="flex flex-col">
          {CATEGORIES.map((c) => {
            const count = facets?.categories.find((x) => x.id === c.id)?.count
            const active = selectedCats.has(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={itemCls(active)}
                  aria-pressed={active}
                  onClick={() => onChange({ cat: toggleCsv(search.cat, c.id) })}
                >
                  <span>{c.label}</span>
                  {count === undefined ? <Skeleton className="h-3 w-6" /> : <span className="tabular-nums">({count})</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby={`${idPrefix}-price`}>
        <h2 id={`${idPrefix}-price`} className="mb-4 text-base font-bold">
          Faixa de preço
        </h2>
        <Slider
          min={bounds[0]}
          max={bounds[1]}
          step={1}
          value={range}
          onValueChange={setRange}
          minStepsBetweenThumbs={1}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          className="px-1"
        />
        <p className="mt-4 text-sm" aria-live="polite">
          Preço: {fmt(range[0])} - {fmt(range[1])} ETH
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            className="h-9 px-3"
            onClick={() =>
              onChange({
                min: range[0] > bounds[0] ? fromCents(range[0]) : undefined,
                max: range[1] < bounds[1] ? fromCents(range[1]) : undefined,
              })
            }
          >
            Aplicar
          </Button>
          {search.min || search.max ? (
            <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => onChange({ min: undefined, max: undefined })}>
              Limpar faixa
            </button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby={`${idPrefix}-net`}>
        <h2 id={`${idPrefix}-net`} className="mb-3 text-base font-bold">
          Rede
        </h2>
        <ul className="flex flex-col">
          {NETWORKS.map((n) => {
            const count = facets?.networks.find((x) => x.id === n.id)?.count
            const active = selectedNets.has(n.id)
            return (
              <li key={n.id}>
                <button type="button" className={itemCls(active)} aria-pressed={active} onClick={() => onChange({ net: toggleCsv(search.net, n.id) })}>
                  <span>{n.label}</span>
                  {count === undefined ? <Skeleton className="h-3 w-6" /> : <span className="tabular-nums">({count})</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
