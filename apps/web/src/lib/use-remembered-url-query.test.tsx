import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { rememberedSearch, useRememberedUrlQuery } from './use-remembered-url-query'

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/tasks',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const schema = z.object({
  team: z.string().catch('').default(''),
  task: z.string().catch('').default(''),
})
type Query = z.infer<typeof schema>
const parse = (params: URLSearchParams) => schema.parse(Object.fromEntries(params))
const DEFAULTS: Query = schema.parse({})
const KEY = 'test:board'

function mount() {
  return renderHook(() => useRememberedUrlQuery(KEY, parse, DEFAULTS, ['task']))
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  nav.search = ''
})

describe('useRememberedUrlQuery', () => {
  it('brings back the saved filters when the page opens bare', () => {
    window.localStorage.setItem(KEY, 'team=it')

    mount()

    expect(nav.replace).toHaveBeenCalledWith('/tasks?team=it', { scroll: false })
  })

  it('lets a link with its own filters win, and remembers those instead', () => {
    window.localStorage.setItem(KEY, 'team=it')
    nav.search = 'team=finance'

    mount()

    expect(nav.replace).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(KEY)).toBe('team=finance')
  })

  it('opens a link to one task inside the saved filters, without forgetting them', () => {
    window.localStorage.setItem(KEY, 'team=it')
    nav.search = 'task=task-7'

    mount()

    expect(nav.replace).toHaveBeenCalledWith('/tasks?team=it&task=task-7', { scroll: false })
    expect(window.localStorage.getItem(KEY)).toBe('team=it')
  })

  it('forgets the filters once they are cleared', () => {
    window.localStorage.setItem(KEY, 'team=it')
    nav.search = 'team=it'
    const hook = mount()

    nav.search = ''
    hook.rerender()

    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('still works when the browser refuses storage', () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => mount()).not.toThrow()
    expect(nav.replace).not.toHaveBeenCalled()
    blocked.mockRestore()
  })
})

describe('rememberedSearch', () => {
  it('drops the params that open one thing', () => {
    expect(
      rememberedSearch(new URLSearchParams('team=it&task=t-1&tab=history'), ['task', 'tab']),
    ).toBe('team=it')
  })
})
