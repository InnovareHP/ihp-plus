import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { CatalogItemRow } from '../schema'
import { RateCard } from './rate-card'

const rpc = vi.hoisted(() => ({
  listCatalog: vi.fn(),
  createCatalogItem: vi.fn(),
  updateCatalogItem: vi.fn(),
  setCatalogItemArchived: vi.fn(),
}))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))
const lookups = vi.hoisted(() => ({
  listLookupOptions: vi.fn(),
  addLookupOptions: vi.fn(),
  retireLookupOption: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/lib/undo', () => undo)
vi.mock('@/features/lookups/actions', () => lookups)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const LOGO: CatalogItemRow = {
  id: 'item-1',
  category: 'Creative services',
  name: 'Logo design',
  description: 'A mark and its variants',
  priceMinCents: 150_000,
  priceMaxCents: 300_000,
  unit: 'project',
  percentOfSpend: undefined,
  defaultTerms: undefined,
  archived: false,
}

const user = () => userEvent.setup()

async function chooseSection(person: ReturnType<typeof user>, dialog: HTMLElement) {
  await person.click(within(dialog).getByRole('combobox', { name: /Section/ }))
  await person.click(await screen.findByRole('option', { name: 'Creative services' }))
}

describe('RateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listCatalog.mockResolvedValue([])
    rpc.createCatalogItem.mockResolvedValue(LOGO)
    lookups.listLookupOptions.mockResolvedValue({
      ok: true,
      data: { catalogSection: ['Creative services', 'Website', 'IT department'] },
    })
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
    await chooseSection(person, dialog)
    await person.type(within(dialog).getByLabelText(/Service name/), 'Logo design')
    await person.type(within(dialog).getByLabelText(/Price from/), '1500')
    await person.type(within(dialog).getByLabelText(/Price to/), '3000')
    await person.click(within(dialog).getByRole('button', { name: 'Add service' }))

    await waitFor(() =>
      expect(rpc.createCatalogItem).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Creative services',
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

  it('groups services under admin sections in list order, IT department included', async () => {
    rpc.listCatalog.mockResolvedValue([
      { ...LOGO, id: 'help', category: 'IT department', name: 'Help desk' },
      LOGO,
      { ...LOGO, id: 'site', category: 'Website', name: 'Landing page' },
    ])
    render(<RateCard canManage />)

    await screen.findByText('Help desk')
    await waitFor(() =>
      expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
        'Creative services',
        'Website',
        'IT department',
      ]),
    )
  })

  it('opens the section list for an admin to add Website or IT department', async () => {
    rpc.listCatalog.mockResolvedValue([LOGO])
    const person = user()
    render(<RateCard canManage />)

    await person.click(await screen.findByRole('button', { name: 'Manage sections' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('IT department')
  })

  it('requires a section, a name and a range that does not run backwards', async () => {
    const person = user()
    render(<RateCard canManage />)

    await person.click(await screen.findByRole('button', { name: 'Add service' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a service' })
    await person.type(within(dialog).getByLabelText(/Price from/), '500')
    await person.type(within(dialog).getByLabelText(/Price to/), '100')
    await person.click(within(dialog).getByRole('button', { name: 'Add service' }))

    expect(await within(dialog).findByText('Name the service')).toBeInTheDocument()
    expect(within(dialog).getByText('Choose a section')).toBeInTheDocument()
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
    await chooseSection(person, dialog)
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

  describe('editing and archiving', () => {
    beforeEach(() => {
      rpc.listCatalog.mockResolvedValue([LOGO])
      rpc.updateCatalogItem.mockResolvedValue({ ...LOGO, priceMinCents: 200_000 })
      rpc.setCatalogItemArchived.mockResolvedValue({ ...LOGO, archived: true })
    })

    it('asks a manager for the archived services too', async () => {
      render(<RateCard canManage />)
      await screen.findByText('Logo design')
      expect(rpc.listCatalog).toHaveBeenCalledWith(true)
    })

    it('offers no row actions to someone who cannot change the card', async () => {
      render(<RateCard canManage={false} />)

      expect(await screen.findByText('Logo design')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Actions for Logo design' }),
      ).not.toBeInTheDocument()
      expect(rpc.listCatalog).toHaveBeenCalledWith(false)
    })

    it('opens a service with its values filled in and saves the correction', async () => {
      const person = user()
      render(<RateCard canManage />)

      await person.click(await screen.findByRole('button', { name: 'Actions for Logo design' }))
      await person.click(await screen.findByRole('menuitem', { name: 'Edit' }))

      const dialog = await screen.findByRole('dialog', { name: 'Edit Logo design' })
      expect(within(dialog).getByLabelText(/Service name/)).toHaveValue('Logo design')
      const from = within(dialog).getByLabelText(/Price from/)
      await person.clear(from)
      await person.type(from, '2000')
      await person.click(within(dialog).getByRole('button', { name: 'Save changes' }))

      await waitFor(() =>
        expect(rpc.updateCatalogItem).toHaveBeenCalledWith(
          'item-1',
          expect.objectContaining({ name: 'Logo design', priceMinCents: 200_000 }),
        ),
      )
    })

    it('archives at once and only tells the server when undo is passed up', async () => {
      const person = user()
      render(<RateCard canManage />)

      await person.click(await screen.findByRole('button', { name: 'Actions for Logo design' }))
      await person.click(await screen.findByRole('menuitem', { name: 'Archive' }))

      expect(await screen.findByRole('table', { name: 'Archived services' })).toBeInTheDocument()
      expect(rpc.setCatalogItemArchived).not.toHaveBeenCalled()

      undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
      await waitFor(() => expect(rpc.setCatalogItemArchived).toHaveBeenCalledWith('item-1', true))
    })

    it('puts an archived service back on undo', async () => {
      const person = user()
      render(<RateCard canManage />)

      await person.click(await screen.findByRole('button', { name: 'Actions for Logo design' }))
      await person.click(await screen.findByRole('menuitem', { name: 'Archive' }))
      await screen.findByRole('table', { name: 'Archived services' })

      undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

      await waitFor(() =>
        expect(screen.queryByRole('table', { name: 'Archived services' })).not.toBeInTheDocument(),
      )
      expect(rpc.setCatalogItemArchived).not.toHaveBeenCalled()
    })

    it('restores an archived service to the card', async () => {
      rpc.listCatalog.mockResolvedValue([{ ...LOGO, archived: true }])
      rpc.setCatalogItemArchived.mockResolvedValue(LOGO)
      const person = user()
      render(<RateCard canManage />)

      expect(await screen.findByText('Every service is archived')).toBeInTheDocument()
      await person.click(screen.getByRole('button', { name: 'Actions for Logo design' }))
      await person.click(await screen.findByRole('menuitem', { name: 'Restore to the rate card' }))

      await waitFor(() => expect(rpc.setCatalogItemArchived).toHaveBeenCalledWith('item-1', false))
    })
  })
})
