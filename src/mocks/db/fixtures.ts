/**
 * Fixtures determinísticas. Mesma semente → mesmo catálogo, sempre.
 * Os 9 primeiros NFTs reproduzem os do Figma; o restante é gerado para
 * exercitar filtros, ordenação e paginação.
 */
import type { CategoryId, Edition, EditionKind, Network, NftDetail, NftImage } from '@/contracts'
import { percentEth } from '@/lib/eth'
import { mulberry32 } from '../lib/random'

export const FIXTURE_NOW = Date.parse('2026-07-29T12:00:00.000Z')

type Art = 'emerald' | 'violet' | 'ivory' | 'golden'

const ART_ALT: Record<Art, string> = {
  emerald: 'Macaco de pelagem marrom com óculos redondos verdes e jaqueta college verde com colar de esmeralda',
  violet: 'Gorila grisalho com chapéu bucket verde-sálvia e moletom roxo, sorrindo',
  ivory: 'Macaco de pelagem preta com blazer creme e gola alta verde-escura, olhar sério',
  golden: 'Macaco de pelagem dourada com fones de ouvido verdes e jaqueta creme, sobre círculo verde',
}

const COLLECTION_BY_ART: Record<Art, { id: string; name: string }> = {
  emerald: { id: 'kurio-apes', name: 'Kurio Apes' },
  violet: { id: 'nomad-club', name: 'Nomad Club' },
  ivory: { id: 'baron-society', name: 'Baron Society' },
  golden: { id: 'golden-frequency', name: 'Golden Frequency' },
}

const ATTRS_BY_ART: Record<Art, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  violet: ['Bucket hat', 'Moletom', 'Grisalho'],
  ivory: ['Blazer', 'Gola alta', 'Brinco'],
  golden: ['Fones', 'Dourado', 'Aura verde'],
}

const CATEGORY_IDS: CategoryId[] = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
]
const NETWORK_IDS: Network[] = ['ethereum', 'polygon', 'solana']

interface Seed {
  name: string
  num: number
  art: Art
  price: string
  previousPrice?: string
  rarity?: NftDetail['rarity']
  category: CategoryId
  network: Network
}

/** Os NFTs que aparecem no Figma, na mesma ordem do grid "Listados recentemente". */
const FIGMA_SEEDS: Seed[] = [
  { name: 'Emerald Ape', num: 42, art: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad', num: 9, art: 'violet', price: '1.69', category: 'arte-digital', network: 'ethereum' },
  { name: 'Neon Vessel', num: 552, art: 'ivory', price: '1.99', previousPrice: '2.29', rarity: 'rare', category: 'colecionaveis', network: 'ethereum' },
  { name: 'Cosmic Bloom', num: 118, art: 'violet', price: '1.29', category: 'generativa', network: 'polygon' },
  { name: 'Violet Nomad', num: 314, art: 'violet', price: '1.39', category: 'arte-digital', network: 'ethereum' },
  { name: 'Ivory Baron', num: 88, art: 'ivory', price: '1.79', category: 'arte-3d', network: 'ethereum' },
  { name: 'Golden Beat', num: 207, art: 'golden', price: '0.99', category: 'musica', network: 'solana' },
  { name: 'Golden Frequency', num: 71, art: 'golden', price: '0.59', category: 'musica', network: 'polygon' },
  { name: 'Golden Signal', num: 160, art: 'golden', price: '0.39', category: 'musica', network: 'solana' },
]

const ADJECTIVES = ['Amber', 'Velvet', 'Lunar', 'Rustic', 'Silent', 'Copper', 'Jade', 'Solar', 'Misty', 'Royal', 'Echo', 'Cedar']
const NOUNS: Record<Art, string[]> = {
  emerald: ['Ape', 'Captain', 'Scholar', 'Jeweler'],
  violet: ['Nomad', 'Wanderer', 'Drifter', 'Hiker'],
  ivory: ['Baron', 'Vessel', 'Curator', 'Envoy'],
  golden: ['Beat', 'Signal', 'Frequency', 'Echo'],
}
const ARTS: Art[] = ['emerald', 'violet', 'ivory', 'golden']

export const CATALOG_SIZE = 72

function pad(num: number, size = 4) {
  return num.toString().padStart(size, '0')
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function image(art: Art, name: string): NftImage {
  return { src: `/images/nfts/${art}`, alt: `${name}: ${ART_ALT[art]}` }
}

function gallery(art: Art, name: string): NftImage[] {
  return [
    image(art, name),
    { ...image(art, name), alt: `${name}, detalhe do rosto`, crop: { scale: 1.8, x: 50, y: 35 } },
    { ...image(art, name), alt: `${name}, detalhe do acessório`, crop: { scale: 2.2, x: 50, y: 80 } },
    { ...image(art, name), alt: `${name}, detalhe da textura`, crop: { scale: 2.6, x: 25, y: 20 } },
  ]
}

function editions(id: string, basePrice: string, rand: () => number, opts: { soldOutAll?: boolean; scarce?: boolean }): Edition[] {
  const spec: { kind: EditionKind; label: string; bps: number; supply: number | null; maxPerOrder: number }[] = [
    { kind: '1/1', label: '1/1', bps: 30_000, supply: 1, maxPerOrder: 1 },
    { kind: '1/10', label: '1/10', bps: 15_000, supply: 10, maxPerOrder: 5 },
    { kind: '1/50', label: '1/50', bps: 10_000, supply: 50, maxPerOrder: 10 },
    { kind: 'open', label: 'ABERTA', bps: 6_000, supply: null, maxPerOrder: 10 },
  ]
  return spec.map((s) => {
    let available: number | null
    if (s.supply === null) available = opts.soldOutAll ? 0 : null
    else if (opts.soldOutAll) available = 0
    else if (s.kind === '1/1') available = rand() < 0.5 ? 1 : 0
    else if (opts.scarce && s.kind === '1/50') available = 3
    else available = Math.max(0, Math.floor(rand() * s.supply))
    if (s.kind === '1/50' && !opts.soldOutAll && !opts.scarce) available = Math.max(available ?? 0, 12)
    return {
      id: `${id}:${s.kind}`,
      kind: s.kind,
      label: s.label,
      price: s.bps === 10_000 ? basePrice : percentEth(basePrice, s.bps),
      available,
      supply: s.supply,
      maxPerOrder: s.maxPerOrder,
    }
  })
}

function build(seed: Seed, index: number, rand: () => number, extra: { soldOutAll?: boolean; scarce?: boolean } = {}): NftDetail {
  const id = `nft-${pad(seed.num, 3)}`
  const fullName = `${seed.name} #${pad(seed.num, 3)}`
  const eds = editions(id, seed.price, rand, extra)
  const collection = COLLECTION_BY_ART[seed.art]
  const networkLabel = seed.network === 'ethereum' ? 'Ethereum' : seed.network === 'polygon' ? 'Polygon' : 'Solana'
  const listedAt = new Date(FIXTURE_NOW - index * 7 * 3_600_000).toISOString()
  return {
    id,
    slug: slugify(fullName),
    name: fullName,
    tokenId: `#${pad(seed.num)}`,
    image: image(seed.art, fullName),
    price: seed.price,
    previousPrice: seed.previousPrice ?? null,
    category: seed.category,
    network: seed.network,
    rarity: seed.rarity ?? (rand() < 0.12 ? 'rare' : 'common'),
    listedAt,
    trendingScore: Math.round(rand() * 1000),
    isNew: index < 18,
    soldOut: eds.every((e) => e.available === 0),
    version: 1,
    description: `Um colecionável digital ${eds[2].label} finalizado à mão da coleção ${collection.name}, verificado na ${networkLabel}, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${fullName} é uma obra digital 1/50 finalizada à mão da coleção ${collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabel}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    collection,
    creator: { name: 'Nova Sato', royaltyBps: 500 },
    attributes: [...ATTRS_BY_ART[seed.art].slice(0, 2), seed.rarity === 'rare' ? 'Raro' : 'Edição limitada'],
    contractAddress: `0x7A42${pad(seed.num, 4)}9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e19E8`.slice(0, 42),
    gallery: gallery(seed.art, fullName),
    editions: eds,
    defaultEditionId: eds[2].id,
    rating: { average: 4.8, count: 19 },
  }
}

export function buildCatalog(): NftDetail[] {
  const rand = mulberry32(20260729)
  const list: NftDetail[] = FIGMA_SEEDS.map((s, i) => build(s, i, rand, s.num === 552 ? { scarce: true } : {}))
  const used = new Set(list.map((n) => n.id))
  let i = 0
  while (list.length < CATALOG_SIZE) {
    const art = ARTS[i % ARTS.length]
    const name = `${ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]} ${NOUNS[art][Math.floor(rand() * 4)]}`
    let num = 100 + Math.floor(rand() * 899)
    while (used.has(`nft-${pad(num, 3)}`)) num = (num + 7) % 999 || 1
    used.add(`nft-${pad(num, 3)}`)
    // preços entre 0.02 e 12.30 (faixa do Figma) com 2 casas
    const cents = 2 + Math.floor(Math.pow(rand(), 2.2) * 1228)
    const price = `${Math.floor(cents / 100)}.${pad(cents % 100, 2)}`
    const seed: Seed = {
      name,
      num,
      art,
      price,
      previousPrice: rand() < 0.1 ? `${Math.floor(cents / 100) + 1}.${pad(cents % 100, 2)}` : undefined,
      category: CATEGORY_IDS[Math.floor(rand() * CATEGORY_IDS.length)],
      network: NETWORK_IDS[Math.floor(rand() * NETWORK_IDS.length)],
    }
    // um NFT totalmente esgotado para o cenário de edição indisponível
    list.push(build(seed, list.length, rand, list.length === 20 ? { soldOutAll: true } : {}))
    i++
  }
  // garante preços extremos da faixa do layout
  list[CATALOG_SIZE - 1] = { ...list[CATALOG_SIZE - 1], price: '12.30', editions: list[CATALOG_SIZE - 1].editions.map((e) => (e.kind === '1/50' ? { ...e, price: '12.30' } : e)) }
  list[CATALOG_SIZE - 2] = { ...list[CATALOG_SIZE - 2], price: '0.02', editions: list[CATALOG_SIZE - 2].editions.map((e) => (e.kind === '1/50' ? { ...e, price: '0.02' } : e)) }
  return list
}

export const SOLD_OUT_NFT_INDEX = 20

/** Usuários fictícios — a senha (documentada no README) existe aqui apenas como hash SHA-256 com sal. */
export const FIXTURE_USERS = [
  {
    id: 'usr-ana',
    username: 'ana.kurio',
    displayName: 'Ana Colecionadora',
    email: 'ana@kurio.test',
    avatarUrl: null,
    ensName: 'ana-kurio',
    ensTld: '.eth' as const,
    walletNickname: 'Reserva',
    createdAt: '2026-01-10T10:00:00.000Z',
    salt: 's4lt-ana-01',
    passwordHash: '9342e04e9df50f79655faa2ce3c7f1309b4a36fc29f718f1e3670470164a30ff',
  },
  {
    id: 'usr-bruno',
    username: 'bruno',
    displayName: 'Bruno Nômade',
    email: 'bruno@kurio.test',
    avatarUrl: null,
    ensName: 'bruno-nomad',
    ensTld: '.eth' as const,
    walletNickname: 'Principal',
    createdAt: '2026-02-02T10:00:00.000Z',
    salt: 's4lt-bruno-02',
    passwordHash: '33ca2aae09378b6fa33d6d53bd1ac0af17afff3cdcdc499333fcbd2ce9b33b10',
  },
]

export const FIXTURE_WALLETS = {
  'usr-ana': {
    primary: {
      slot: 'primary' as const,
      displayName: 'Ana Colecionadora',
      nickname: 'Principal',
      network: 'ethereum' as const,
      profileName: 'ana.kurio',
      address: '0xA91F3c2B7d4E5f60718293aBcDeF0123456E82C',
      ensOrSecondary: null,
      provider: 'metamask' as const,
      referralCode: 'KURIO42',
      email: 'ana@kurio.test',
      ensName: 'ana-kurio',
      ensTld: '.eth' as const,
      updatedAt: '2026-06-01T10:00:00.000Z',
    },
    secondary: {
      slot: 'secondary' as const,
      displayName: 'Ana Colecionadora',
      nickname: 'Reserva',
      network: 'polygon' as const,
      profileName: 'nova.kurio',
      address: '0x5bE0a1C2d3E4f5A6b7C8d9E0f1A2b3C4d5E6f7A8',
      ensOrSecondary: 'nova.kurio.eth',
      provider: 'coinbase' as const,
      referralCode: 'KURIO42',
      email: 'ana@kurio.test',
      ensName: 'nova-kurio',
      ensTld: '.eth' as const,
      updatedAt: '2026-06-01T10:00:00.000Z',
    },
    secondarySameAsPrimary: false,
  },
  'usr-bruno': { primary: null, secondary: null, secondarySameAsPrimary: false },
}

export const COUPONS: Record<string, { bps: number; expiresAt: string; description: string }> = {
  KURIO10: { bps: 1000, expiresAt: '2099-12-31T23:59:59.000Z', description: 'Desconto de lançamento (10%)' },
  GENESIS25: { bps: 2500, expiresAt: '2099-12-31T23:59:59.000Z', description: 'Gênesis (25%)' },
  VERAO5: { bps: 500, expiresAt: '2026-03-01T00:00:00.000Z', description: 'Verão (5%)' },
}

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.0005',
}
