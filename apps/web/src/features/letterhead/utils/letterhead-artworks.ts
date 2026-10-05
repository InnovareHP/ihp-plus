import { LETTERHEAD_ARTWORK } from './letterhead-artwork'
import { ELDON_ARTWORK } from './letterhead-artwork-eldon'
import { INNOVARE_ARTWORK } from './letterhead-artwork-innovare'
import { REFIDLY_ARTWORK } from './letterhead-artwork-refidly'
import type { ArtworkName } from './letterhead-templates'

export const LETTERHEAD_ARTWORKS = {
  official: LETTERHEAD_ARTWORK,
  innovarehp: INNOVARE_ARTWORK,
  eldon: ELDON_ARTWORK,
  refidly: REFIDLY_ARTWORK,
} as const satisfies Record<ArtworkName, typeof LETTERHEAD_ARTWORK>
