import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Providers } from './providers'

describe('Providers', () => {
  it('replaces Mantine’s dimmed grey with shades that pass AA in both schemes', () => {
    render(
      <Providers>
        <p>Body</p>
      </Providers>,
    )

    const styles = [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('\n')
    expect(styles).toMatch(/--mantine-color-dimmed:\s*var\(--mantine-color-gray-7\)/)
    expect(styles).toMatch(/--mantine-color-dimmed:\s*var\(--mantine-color-dark-1\)/)
  })
})
