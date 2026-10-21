'use client'

import { ActionIcon, Button, Kbd } from '@mantine/core'
import { useHotkeys, useOs } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { track } from '@/lib/analytics'
import { searchEvents } from '../events'
import { searchSpotlight } from '../spotlight-store'
import touch from '@/components/touch-target.module.css'
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
      {/* Looks like a quiet search field rather than one more button, so the header reads calmly. */}
      {/* A tablet's header already carries the sidebar toggle, so the full field waits for a laptop. */}
      <Button
        visibleFrom="md"
        variant="default"
        w={220}
        justify="space-between"
        fw={400}
        c="dimmed"
        leftSection={<IconSearch size={16} aria-hidden />}
        rightSection={<Kbd size="xs">{shortcut}</Kbd>}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={open}
        onMouseEnter={warm}
        onFocus={warm}
      >
        Search…
      </Button>
      <ActionIcon
        hiddenFrom="md"
        variant="subtle"
        color="gray"
        size="lg"
        className={touch.target}
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
