import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function NotFound({ title = 'Página não encontrada', description = 'O endereço acessado não existe ou foi removido.' }: { title?: string; description?: string }) {
  useDocumentTitle(title)
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="nf-title">
      <p className="text-6xl font-bold text-primary" aria-hidden>
        404
      </p>
      <h1 id="nf-title" className="text-2xl font-bold">
        {title}
      </h1>
      <p className="max-w-md text-muted-foreground">{description}</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/mercado">Explorar mercado</Link>
        </Button>
      </div>
    </section>
  )
}
