import { LETTERHEAD_ARTWORK } from './letterhead-artwork'
import { INNOVARE_ARTWORK } from './letterhead-artwork-innovare'
import type { ArtworkName } from './letterhead-templates'

export const LETTERHEAD_ARTWORKS = {
  official: LETTERHEAD_ARTWORK,
  innovarehp: INNOVARE_ARTWORK,
} as const satisfies Record<ArtworkName, typeof LETTERHEAD_ARTWORK>
