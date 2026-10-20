'use client'

import { Menu, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useMounted } from '@mantine/hooks'
import { IconMoon, IconSun } from '@tabler/icons-react'

/** The theme switch, kept in the account menu so the header carries only what is used daily. */
export function ColorSchemeMenuItem() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light')
  // A saved scheme lives in localStorage, which the server never sees, so the label waits for mount.
  const mounted = useMounted()
  const next = computed === 'dark' ? 'light' : 'dark'
  const Icon = next === 'dark' ? IconMoon : IconSun

  return (
    <Menu.Item
      leftSection={<Icon size={16} aria-hidden />}
      // The menu stays open, so the person sees the theme change before moving on.
      closeMenuOnClick={false}
      onClick={() => setColorScheme(next)}
    >
      {mounted ? `Switch to ${next} theme` : 'Switch color theme'}
    </Menu.Item>
  )
}
