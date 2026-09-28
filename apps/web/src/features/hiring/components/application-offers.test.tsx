import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { ApplicationSummary, OfferRow } from '../schema'
import { ApplicationOffers } from './application-offers'

const actions = vi.hoisted(() => ({ sendOffer: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('../public-actions', () => ({ answerOffer: vi.fn() }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

const APPLICATION = {
  id: 'app-1',
  fullName: 'Grace Hopper',
  status: 'active',
} as ApplicationSummary

const DECLINED: OfferRow = {
  id: 'offer-1',
  status: 'declined',
  message: 'Welcome aboard.',
  fileName: 'offer.pdf',
  fileSize: 20480,
  declineReason: 'The salary is below my current one.',
  createdAt: '2030-10-14T02:00:00.000Z',
  respondedAt: '2030-10-15T02:00:00.000Z',
  createdByName: 'Rita Santos',
}

function renderOffers(offers: OfferRow[] = [], inOfferStage = true) {
  return render(
    <ApplicationOffers application={APPLICATION} offers={offers} inOfferStage={inOfferStage} />,
  )
}

// The page's button and the dialog's share a name, so a submit is found inside the dialog.
function submitOffer(user: ReturnType<typeof userEvent.setup>) {
  return user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Send/ }))
}

function fileInput() {
  // Mantine's FileInput is a button over a hidden input, and the input is what takes the file.
  return document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.sendOffer.mockResolvedValue({
    ok: true,
    data: { summary: APPLICATION, offers: [{ ...DECLINED, status: 'sent' }] },
  })
})

describe('ApplicationOffers', () => {
  it('sends an offer with its letter as one upload', async () => {
    const user = userEvent.setup()
    renderOffers()

    await user.click(screen.getByRole('button', { name: 'Send offer' }))
    await user.upload(
      fileInput(),
      new File(['letter'], 'grace-offer.pdf', { type: 'application/pdf' }),
    )
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations()
    await submitOffer(user)

    await waitFor(() => expect(actions.sendOffer).toHaveBeenCalled())
    const form = actions.sendOffer.mock.calls[0]?.[0] as FormData
    expect(form.get('applicationId')).toBe('app-1')
    expect(String(form.get('message'))).toMatch(/delighted to offer you this role/)
    expect((form.get('file') as File).name).toBe('grace-offer.pdf')
  })

  it('refuses a letter that is not a document before anything is sent', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderOffers()

    await user.click(screen.getByRole('button', { name: 'Send offer' }))
    await user.upload(fileInput(), new File(['png'], 'photo.png', { type: 'image/png' }))
    await submitOffer(user)

    expect(
      await screen.findByText('Attach the letter as a PDF or Word document.'),
    ).toBeInTheDocument()
    expect(actions.sendOffer).not.toHaveBeenCalled()
  })

  it('shows why the offer could not be sent, and keeps the message', async () => {
    actions.sendOffer.mockResolvedValue({
      ok: false,
      message: 'Move them to the offer stage first.',
    })
    const user = userEvent.setup()
    renderOffers()

    await user.click(screen.getByRole('button', { name: 'Send offer' }))
    await submitOffer(user)

    expect(await screen.findByText('Move them to the offer stage first.')).toBeInTheDocument()
    expect((screen.getByLabelText(/Message/) as HTMLTextAreaElement).value).toMatch(
      /delighted to offer/,
    )
  })

  it('after a decline, shows the reason and starts the revision from the old wording', async () => {
    const user = userEvent.setup()
    renderOffers([DECLINED])

    expect(screen.getByText(/The salary is below my current one/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send a revised offer' }))

    expect(screen.getByRole('dialog', { name: 'Send Grace a revised offer' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Message/)).toHaveValue('Welcome aboard.')
  })

  it('offers nothing new while one is waiting or once it is accepted', () => {
    const { rerender } = renderOffers([{ ...DECLINED, status: 'sent', respondedAt: undefined }])
    expect(screen.queryByRole('button', { name: /Send/ })).not.toBeInTheDocument()

    rerender(
      <ApplicationOffers
        application={APPLICATION}
        offers={[{ ...DECLINED, status: 'accepted', declineReason: undefined }]}
        inOfferStage
      />,
    )
    expect(screen.queryByRole('button', { name: /Send/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Hire them to send the invitation/)).toBeInTheDocument()
  })

  it('points HR to the offer stage when they are not there yet', () => {
    renderOffers([], false)

    expect(screen.getByText('Move them to the offer stage to send an offer.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send offer' })).not.toBeInTheDocument()
  })
})
