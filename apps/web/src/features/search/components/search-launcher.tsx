'use client'

import { ActionIcon, Button, Kbd } from '@mantine/core'
import { useHotkeys, useOs } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { track } from '@/lib/analytics'
import { searchEvents } from '../events'
import { searchSpotlight } from '../spotlight-store'
import type { SearchPaletteProps } from './search-palette'

const loadPalette = () => import('./search-palette').then((module) => module.SearchPalette)
const SearchPalette = dynamic(loadPalette, { ssr: false })

export type SearchLauncherProps = SearchPaletteProps

export function SearchLauncher(props: SearchLauncherProps) {
  // Local UI state: the palette's code is only fetched once someone first asks for it.
  const [requested, setRequested] = useState(false)
  const shortcut = useOs() === 'macos' ? '⌘ K' : 'Ctrl K'

  function open() {
    setRequested(true)
    searchSpotlight.open()
    track(searchEvents.paletteOpened)
  }

  function warm() {
    void loadPalette()
  }

  // Inputs and the rich text editor keep Ctrl+K for themselves; useHotkeys skips them by default.
  useHotkeys([['mod+K', open]])

  return (
    <>
      <Button
        visibleFrom="sm"
        variant="default"
        leftSection={<IconSearch size={16} aria-hidden />}
        rightSection={<Kbd size="xs">{shortcut}</Kbd>}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={open}
        onMouseEnter={warm}
        onFocus={warm}
      >
        Search
      </Button>
      <ActionIcon
        hiddenFrom="sm"
        variant="default"
        size="lg"
        aria-label="Search"
        onClick={open}
        onFocus={warm}
      >
        <IconSearch size={18} aria-hidden />
      </ActionIcon>
      {requested ? <SearchPalette {...props} /> : null}
    </>
  )
}
