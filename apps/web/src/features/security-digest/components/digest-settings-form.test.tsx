import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { DigestSettingsForm } from './digest-settings-form'

const SETTINGS = { enabled: false, recipients: [], includeClients: false, reportTo: '' }

function renderForm(overrides: Partial<Parameters<typeof DigestSettingsForm>[0]> = {}) {
  const onSave = vi.fn(async () => undefined)
  const view = render(
    <DigestSettingsForm
      settings={SETTINGS}
      clientContacts={4}
      canManage
      onSave={onSave}
      {...overrides}
    />,
  )
  return { ...view, onSave }
}

describe('DigestSettingsForm', () => {
  it('saves the switch, recipients and report-to address', async () => {
    const user = userEvent.setup()
    const { onSave, container } = renderForm()

    await user.click(screen.getByRole('switch', { name: /send weekly security emails/i }))
    await user.type(screen.getByRole('combobox', { name: 'Recipients' }), 'me@ihp.test{Enter}')
    await user.type(screen.getByRole('textbox', { name: 'Report concerns to' }), 'it@ihp.test')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(onSave).toHaveBeenCalledWith({
      enabled: true,
      recipients: ['me@ihp.test'],
      includeClients: false,
      reportTo: 'it@ihp.test',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says how many client contacts would be added', () => {
    renderForm()

    expect(screen.getByText(/4 right now/)).toBeInTheDocument()
  })

  it('announces an address that is not an email and does not save', async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm()

    await user.type(screen.getByRole('combobox', { name: 'Recipients' }), 'not-an-email{Enter}')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/must be an email address/)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows a server failure above the form and keeps what was typed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async () => {
      throw new Error('Only the IT lead or an admin can change the security emails.')
    })
    renderForm({ onSave })

    await user.type(screen.getByRole('textbox', { name: 'Report concerns to' }), 'it@ihp.test')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only the IT lead')
    expect(screen.getByRole('textbox', { name: 'Report concerns to' })).toHaveValue('it@ihp.test')
  })

  it('is read-only for IT members who cannot manage', () => {
    renderForm({ canManage: false })

    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /send weekly security emails/i })).toBeDisabled()
  })
})
