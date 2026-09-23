import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { CatalogItemRow } from '../schema'
import { RateCard } from './rate-card'

const rpc = vi.hoisted(() => ({ listCatalog: vi.fn(), createCatalogItem: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const LOGO: CatalogItemRow = {
  id: 'item-1',
  category: 'creative',
  name: 'Logo design',
  description: 'A mark and its variants',
  priceMinCents: 150_000,
  priceMaxCents: 300_000,
  unit: 'project',
  percentOfSpend: undefined,
  defaultTerms: undefined,
}

const user = () => userEvent.setup()

describe('RateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listCatalog.mockResolvedValue([])
    rpc.createCatalogItem.mockResolvedValue(LOGO)
  })

  it('offers a manager a way to add the first service', async () => {
    render(<RateCard canManage />)

    expect(await screen.findByText('No rate card yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add service' })).toBeInTheDocument()
  })

  it('tells a non-manager who fills it and offers no add button', async () => {
    rpc.listCatalog.mockResolvedValue([LOGO])
    const { unmount } = render(<RateCard canManage={false} />)
    expect(await screen.findByText('Logo design')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add service' })).not.toBeInTheDocument()
    unmount()

    rpc.listCatalog.mockResolvedValue([])
    render(<RateCard canManage={false} />)
    expect(await screen.findByText(/An organization admin adds services here/)).toBeInTheDocument()
  })

  it('adds a service with its price in cents and closes the form', async () => {
    const person = user()
    render(<RateCard canManage />)

    await person.click(await screen.findByRole('button', { name: 'Add service' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a service' })
    await person.type(within(dialog).getByLabelText(/Service name/), 'Logo design')
    await person.type(within(dialog).getByLabelText(/Price from/), '1500')
    await person.type(within(dialog).getByLabelText(/Price to/), '3000')
    await person.click(within(dialog).getByRole('button', { name: 'Add service' }))

    await waitFor(() =>
      expect(rpc.createCatalogItem).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'creative',
          name: 'Logo design',
          priceMinCents: 150_000,
          priceMaxCents: 300_000,
          unit: 'project',
        }),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add a service' })).not.toBeInTheDocument(),
    )
  })

  it('requires a name and a range that does not run backwards', async () => {
    const person = user()
    render(<RateCard canManage />)

    await person.click(await screen.findByRole('button', { name: 'Add service' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a service' })
    await person.type(within(dialog).getByLabelText(/Price from/), '500')
    await person.type(within(dialog).getByLabelText(/Price to/), '100')
    await person.click(within(dialog).getByRole('button', { name: 'Add service' }))

    expect(await within(dialog).findByText('Name the service')).toBeInTheDocument()
    expect(
      within(dialog).getByText('The top of the range cannot be below the bottom'),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Service name/)).toHaveAttribute('aria-invalid', 'true')
    expect(rpc.createCatalogItem).not.toHaveBeenCalled()
  })

  it('keeps the form and its values when the server refuses', async () => {
    rpc.createCatalogItem.mockRejectedValue(new Error('That service is already on the rate card.'))
    const person = user()
    render(<RateCard canManage />)

    await person.click(await screen.findByRole('button', { name: 'Add service' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a service' })
    await person.type(within(dialog).getByLabelText(/Service name/), 'Logo design')
    await person.click(within(dialog).getByRole('button', { name: 'Add service' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That service is already on the rate card.',
    )
    expect(within(dialog).getByLabelText(/Service name/)).toHaveValue('Logo design')
  })

  it('has no axe violations with the form open', async () => {
    const person = user()
    const { container } = render(<RateCard canManage />)

    await person.click(await screen.findByRole('button', { name: 'Add service' }))
    await screen.findByRole('dialog', { name: 'Add a service' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
