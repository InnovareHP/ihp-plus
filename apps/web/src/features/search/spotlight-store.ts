import { createSpotlight } from '@mantine/spotlight'

// Its own store rather than the package default, so the header button and the hotkey drive this one.
export const [searchStore, searchSpotlight] = createSpotlight()
