/**
 * Feedback acessível: região aria-live global para mutations e eventos em
 * tempo real, complementar aos toasts visuais (sonner).
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Politeness = 'polite' | 'assertive'
type Listener = (msg: { text: string; politeness: Politeness; id: number }) => void
const listeners = new Set<Listener>()
let seq = 0

export function announce(text: string, politeness: Politeness = 'polite') {
  seq += 1
  listeners.forEach((l) => l({ text, politeness, id: seq }))
}

type NotifyKind = 'success' | 'error' | 'info' | 'warning'

/** Toast visual + anúncio para leitores de tela. */
export function notify(kind: NotifyKind, title: string, description?: string) {
  const text = description ? `${title}. ${description}` : title
  announce(text, kind === 'error' || kind === 'warning' ? 'assertive' : 'polite')
  toast[kind](title, { description })
}

export function LiveRegion() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(() => {
    const l: Listener = ({ text, politeness }) => {
      const set = politeness === 'assertive' ? setAssertive : setPolite
      // limpa antes para que mensagens repetidas sejam anunciadas de novo
      set('')
      requestAnimationFrame(() => set(text))
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return (
    <>
      <div aria-live="polite" role="status" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="sr-only" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}
