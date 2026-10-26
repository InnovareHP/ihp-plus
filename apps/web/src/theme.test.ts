import { describe, expect, it } from 'vitest'
import { cssVariablesResolver, theme } from './theme'
import { createTheme, mergeMantineTheme, DEFAULT_THEME } from '@mantine/core'

describe('cssVariablesResolver', () => {
  const resolved = cssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, createTheme(theme)))

  it('darkens the light-badge text of the hues that fell short of AA', () => {
    expect(resolved.light['--mantine-color-yellow-light-color']).toBe(
      'color-mix(in srgb, var(--mantine-color-yellow-9) 65%, black)',
    )
    expect(resolved.light['--mantine-color-blue-light-color']).toBeUndefined()
  })

  it('points coloured text at the badge text colour instead of shade 6', () => {
    expect(resolved.light['--mantine-color-red-text']).toBe('var(--mantine-color-red-light-color)')
  })
})
