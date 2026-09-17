import { describe, expect, it } from 'vitest'
import { browserClients } from './browser'

describe('the browser transport', () => {
  /**
   * A relative baseUrl works in a browser and nowhere else: Node's fetch, which jsdom uses
   * here, rejects it with "Failed to parse URL". A component that reaches a transport in a
   * test used to fail on that rather than on anything it was testing.
   */
  it('reaches an absolute URL rather than failing to parse a relative one', async () => {
    const error = await browserClients.directory
      .listDepartments({})
      .catch((thrown: unknown) => thrown)

    expect(String(error)).not.toContain('Failed to parse URL')
  })
})
