import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { PublicOffer } from '../schema'
import { OfferResponse } from './offer-response'

const actions = vi.hoisted(() => ({ answerOffer: vi.fn() }))
const nav = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('../public-actions', () => actions)
vi.mock('../actions', () => ({ sendOffer: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh }) }))

const OFFER: PublicOffer = {
  id: 'offer-1',
  status: 'sent',
  message: 'We would love you to join the care team.',
  fileName: 'grace-offer.pdf',
  createdAt: '2030-10-14T02:00:00.000Z',
  respondedAt: undefined,
}

function renderOffer(offer: PublicOffer = OFFER) {
  return render(
    <OfferResponse
      offer={offer}
      applicationId="app-1"
      signature="sig"
      letterHref={offer.fileName ? '/app/api/careers/offers/app-1/sig/offer-1' : undefined}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.answerOffer.mockResolvedValue({ ok: true, data: undefined })
})

describe('OfferResponse', () => {
  it('shows the offer and its letter, and accepts in one click', async () => {
    const user = userEvent.setup()
    const { container } = renderOffer()

    expect(screen.getByText('We would love you to join the care team.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Download your offer letter (grace-offer.pdf)' }),
    ).toHaveAttribute('href', '/app/api/careers/offers/app-1/sig/offer-1')
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: 'Accept offer' }))

    await waitFor(() => expect(nav.refresh).toHaveBeenCalled())
    expect(actions.answerOffer).toHaveBeenCalledWith(
      expect.objectContaining({ offerId: 'offer-1', decision: 'accept', signature: 'sig' }),
    )
  })

  it('needs a reason to decline, and announces when it is missing', async () => {
    const user = userEvent.setup()
    renderOffer()

    await user.click(screen.getByRole('button', { name: 'Decline offer' }))
    const reason = screen.getByLabelText(/Why are you declining/)
    await waitFor(() => expect(reason).toHaveFocus())
    await user.click(screen.getByRole('button', { name: 'Decline offer' }))

    expect(await screen.findByText('Tell us why, so we can do better next time.')).toHaveAttribute(
      'role',
      'alert',
    )
    expect(actions.answerOffer).not.toHaveBeenCalled()

    await user.type(reason, 'I accepted another role closer to home.')
    await user.click(screen.getByRole('button', { name: 'Decline offer' }))

    await waitFor(() =>
      expect(actions.answerOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'decline',
          reason: 'I accepted another role closer to home.',
        }),
      ),
    )
  })

  it('lets them change their mind before declining', async () => {
    const user = userEvent.setup()
    renderOffer()

    await user.click(screen.getByRole('button', { name: 'Decline offer' }))
    await user.click(screen.getByRole('button', { name: 'Keep the offer' }))
    await user.click(screen.getByRole('button', { name: 'Accept offer' }))

    await waitFor(() =>
      expect(actions.answerOffer).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'accept' }),
      ),
    )
  })

  it('keeps their answer on screen when the server refuses it', async () => {
    actions.answerOffer.mockResolvedValue({
      ok: false,
      message: 'You already answered this offer.',
    })
    const user = userEvent.setup()
    renderOffer()

    await user.click(screen.getByRole('button', { name: 'Accept offer' }))

    expect(await screen.findByText('You already answered this offer.')).toBeInTheDocument()
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('shows an answered offer as a record, with nothing left to click', () => {
    renderOffer({ ...OFFER, status: 'declined', respondedAt: '2030-10-15T02:00:00.000Z' })

    expect(screen.getByText('You declined this offer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument()
  })
})
