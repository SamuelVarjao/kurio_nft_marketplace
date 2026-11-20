import { createFileRoute, Link } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const LABELS: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  colecao: 'Minha coleção',
  atividade: 'Atividade',
  estudio: 'Estúdio do criador',
  suporte: 'Central de ajuda',
  politica: 'Política do mercado',
  diario: 'Diário da Cunhagem',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
}

/**
 * Seções editoriais/auxiliares fora do escopo da entrega. A página deixa
 * claro que nada foi executado — sem aparentar sucesso funcional.
 */
export const Route = createFileRoute('/em-breve/$secao')({
  component: ComingSoon,
})

function ComingSoon() {
  const { secao } = Route.useParams()
  const label = LABELS[secao] ?? 'Esta seção'
  useDocumentTitle(label)
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="soon-title">
      <Construction className="size-10 text-primary" aria-hidden />
      <h1 id="soon-title" className="text-2xl font-bold">
        {label}
      </h1>
      <p className="max-w-md text-muted-foreground">
        Esta área não faz parte desta demonstração. Nenhuma ação foi realizada — continue explorando o mercado.
      </p>
      <Button asChild>
        <Link to="/mercado">Ir para o mercado</Link>
      </Button>
    </section>
  )
}
