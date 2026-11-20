import { createFileRoute } from '@tanstack/react-router'
import { nftQuery } from '@/features/catalog/hooks'
import { NftDetailPage } from '@/features/nft/NftDetailPage'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQuery(params.nftId))
  },
  component: NftRoute,
})

function NftRoute() {
  const { nftId } = Route.useParams()
  // key: reinicia estado local (edição/quantidade) ao trocar de NFT
  return <NftDetailPage key={nftId} nftId={nftId} />
}
