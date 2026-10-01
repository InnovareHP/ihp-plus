import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'

expect.extend(axeMatchers)

afterEach(cleanup)

// jsdom ships neither API, and Mantine's color-scheme and layout hooks read both.
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// A server-side test opts into the node environment, where there is no DOM to patch.
if (typeof document !== 'undefined') {
  // jsdom has no scrollIntoView, and Mantine's Combobox calls it while highlighting an option.
  Element.prototype.scrollIntoView = vi.fn()

  // jsdom does no layout, and ProseMirror measures the caret to scroll it into view after each edit.
  const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Element.prototype.getClientRects = noRects
  Range.prototype.getClientRects = noRects
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null

  // jsdom ships no FontFaceSet, and Mantine's autosizing Textarea listens for font loading.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })
}
