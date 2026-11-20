import type { NftImage as NftImageData } from '@/contracts'
import { cn } from '@/lib/utils'

const WIDTHS = [320, 640, 960] as const

export function nftSrc(src: string, width: (typeof WIDTHS)[number] = 640) {
  return `${src}-${width}.webp`
}

/**
 * Imagem responsiva com srcset WebP e proporção fixa (1:1) — evita CLS.
 * `crop` aplica zoom/foco para as vistas de detalhe da galeria.
 */
export function NftImage({
  image,
  sizes,
  className,
  priority = false,
  decorative = false,
}: {
  image: NftImageData
  sizes: string
  className?: string
  priority?: boolean
  decorative?: boolean
}) {
  const crop = image.crop
  return (
    <div className={cn('relative aspect-square overflow-hidden bg-surface-2', className)}>
      <img
        src={nftSrc(image.src)}
        srcSet={WIDTHS.map((w) => `${nftSrc(image.src, w)} ${w}w`).join(', ')}
        sizes={sizes}
        alt={decorative ? '' : image.alt}
        width={640}
        height={640}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="size-full object-cover"
        style={
          crop
            ? { transform: `scale(${crop.scale})`, transformOrigin: `${crop.x}% ${crop.y}%` }
            : undefined
        }
      />
    </div>
  )
}
