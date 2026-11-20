/**
 * Painel de demonstração da camada de mocks. Ele NÃO altera o estado do app:
 * chama a API de controle do "servidor" simulado, que responde pelas vias
 * reais (REST via MSW e eventos via socket.io-client).
 */
import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { addEth } from '@/lib/eth'
import { mockControl } from '../control'
import { db } from '../db/store'

const HIDDEN_KEY = 'kurio:mock-panel'

function firstCartLine() {
  const carts = Object.values(db.carts).filter((c) => c.lines.length)
  const cart = carts.sort((a, b) => b.updatedAt - a.updatedAt)[0]
  return cart?.lines[0]
}

export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState(mockControl.scenario())
  const [log, setLog] = useState<string>('')
  const hidden = import.meta.env.VITE_MOCK_PANEL === 'false' || safeGet(HIDDEN_KEY) === 'hidden'
  if (hidden) return null

  const run = (label: string, fn: () => unknown) => {
    try {
      const r = fn()
      setLog(`${label}: ok${r && typeof r === 'object' && 'eventId' in (r as object) ? ` (${(r as { eventId: string }).eventId})` : ''}`)
    } catch (e) {
      setLog(`${label}: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-3 z-50 flex items-center gap-1.5 rounded-full border border-primary/60 bg-card/95 px-3 py-2 text-xs font-bold text-primary shadow-lg md:bottom-4"
        aria-label="Abrir painel de mocks"
        data-testid="mock-panel-toggle"
      >
        <FlaskConical className="size-4" aria-hidden /> Mocks
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[92vw] max-w-sm overflow-y-auto border-border bg-background">
          <SheetHeader>
            <SheetTitle>Cenários simulados (MSW)</SheetTitle>
            <SheetDescription>Ferramenta de demonstração. As ações acontecem no servidor simulado.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-8 text-sm">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-bold">Cenário ativo</legend>
              {mockControl.scenarios().map((s) => (
                <label key={s.id} className="flex cursor-pointer gap-2 rounded-sm border border-border p-2 has-checked:border-primary">
                  <input
                    type="radio"
                    name="mock-scenario"
                    checked={scenario === s.id}
                    onChange={() => {
                      mockControl.setScenario(s.id)
                      setScenario(s.id)
                      setLog(`Cenário: ${s.label}`)
                    }}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-bold">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-2">
              <p className="font-bold">Eventos (Socket.IO)</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run('Preço +0.10', () => {
                    const line = firstCartLine()
                    if (!line) throw new Error('carrinho vazio')
                    const ed = db.nfts[line.nftId].editions.find((e) => e.id === line.editionId)!
                    return mockControl.nft.setPrice(line.nftId, addEth(ed.price, '0.10'), ed.kind)
                  })
                }
              >
                Subir preço do 1º item do carrinho
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run('Esgotar', () => {
                    const line = firstCartLine()
                    if (!line) throw new Error('carrinho vazio')
                    const ed = db.nfts[line.nftId].editions.find((e) => e.id === line.editionId)!
                    return mockControl.nft.setAvailability(line.nftId, 0, ed.kind)
                  })
                }
              >
                Esgotar 1º item do carrinho
              </Button>
              <Button variant="outline" size="sm" onClick={() => run('Reenviar último evento', () => mockControl.socket.replayLast())}>
                Reenviar último evento (duplicata)
              </Button>
              <Button variant="outline" size="sm" onClick={() => run('Evento antigo', () => mockControl.socket.emitStale('nft-042'))}>
                Enviar evento antigo (Emerald Ape)
              </Button>
              <Button variant="outline" size="sm" onClick={() => run('Desconectar 5 s', () => mockControl.socket.disconnect(5_000))}>
                Derrubar socket por 5 s
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-bold">Sessão e falhas</p>
              <Button variant="outline" size="sm" onClick={() => run('Expirar sessão', () => mockControl.session.expireAll())}>
                Expirar sessão agora
              </Button>
              <Button variant="outline" size="sm" onClick={() => run('Falhar próximo catálogo', () => mockControl.failNext('catalog', 500))}>
                Falhar próxima requisição do catálogo (500)
              </Button>
            </div>
            <Button
              onClick={() => {
                mockControl.reset()
                try {
                  localStorage.removeItem('kurio:session')
                  localStorage.removeItem('kurio:guest-cart')
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith('kurio:checkout'))
                    .forEach((k) => localStorage.removeItem(k))
                } catch {
                  /* ignore */
                }
                location.reload()
              }}
            >
              Resetar dados e recarregar
            </Button>
            <button type="button" className="text-xs text-subtle underline" onClick={() => (safeSet(HIDDEN_KEY, 'hidden'), location.reload())}>
              Ocultar este botão (remova `kurio:mock-panel` do localStorage para voltar)
            </button>
            {log ? (
              <p role="status" className="rounded-sm bg-card p-2 text-xs">
                {log}
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function safeGet(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}
