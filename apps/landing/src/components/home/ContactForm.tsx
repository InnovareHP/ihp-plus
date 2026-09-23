import { useState, type SubmitEvent } from 'react'

type Field = 'name' | 'email' | 'phone' | 'message'
type Status = 'idle' | 'sending' | 'sent' | 'failed'

const FIELDS: { name: Field; label: string; type: string; autoComplete: string }[] = [
  { name: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  { name: 'message', label: 'Message', type: 'textarea', autoComplete: 'off' },
]

const MESSAGES: Record<Field, { missing: string; invalid?: string }> = {
  name: { missing: 'Tell us your name.' },
  email: { missing: 'Add an email we can reply to.', invalid: 'That email looks incomplete.' },
  phone: { missing: 'Add a phone number.', invalid: 'Use digits, spaces, + or dashes.' },
  message: { missing: 'Tell us a little about what you need.' },
}

export interface ContactFormProps {
  /** Where the enquiry is posted as JSON; the landing page is static, so it lives in the app. */
  endpoint: string
}

/** The contact form inside the speech bubble: a React island, since it is the page's one control. */
export function ContactForm({ endpoint }: ContactFormProps) {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [status, setStatus] = useState<Status>('idle')

  function errorOf(element: HTMLInputElement | HTMLTextAreaElement, field: Field) {
    if (element.validity.valueMissing || element.value.trim() === '') return MESSAGES[field].missing
    if (!element.validity.valid) return MESSAGES[field].invalid ?? MESSAGES[field].missing
    return undefined
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const next: Partial<Record<Field, string>> = {}
    for (const { name } of FIELDS) {
      const element = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement
      const message = errorOf(element, name)
      if (message) next[name] = message
    }
    setErrors(next)

    const firstInvalid = FIELDS.find(({ name }) => next[name])
    if (firstInvalid) {
      ;(form.elements.namedItem(firstInvalid.name) as HTMLElement).focus()
      return
    }

    setStatus('sending')
    const body = Object.fromEntries(new FormData(form))
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(String(response.status))
      form.reset()
      setStatus('sent')
    } catch {
      // Typed input stays in the fields, so a retry costs one click.
      setStatus('failed')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-[19px]">
        {FIELDS.map((field) => {
          const error = errors[field.name]
          const id = `contact-${field.name}`
          const shared = {
            id,
            name: field.name,
            required: true,
            'aria-required': true,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? `${id}-error` : undefined,
            autoComplete: field.autoComplete,
            placeholder: ' ',
            className:
              'peer block w-full resize-none border-0 border-b border-white bg-transparent pt-[7px] pb-[7px] text-base text-white outline-none focus-visible:border-mint-300 aria-invalid:border-mint-300 [field-sizing:content] max-h-40',
          }
          return (
            <div key={field.name} className="relative">
              {field.type === 'textarea' ? (
                <textarea {...shared} rows={1} />
              ) : (
                <input
                  {...shared}
                  type={field.type}
                  inputMode={field.type === 'tel' ? 'tel' : undefined}
                  pattern={field.type === 'tel' ? '[0-9 ()+.-]{7,20}' : undefined}
                />
              )}
              {/* Sits on the line like the design until the field is focused or filled. */}
              <label
                htmlFor={id}
                className="pointer-events-none absolute top-[7px] left-0.5 text-base text-white transition-all duration-150 ease-out peer-focus:-top-3 peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-3 peer-[:not(:placeholder-shown)]:text-xs motion-reduce:transition-none"
              >
                {field.label} <span aria-hidden="true">*</span>
              </label>
              {error ? (
                <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-mint-300">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="mt-[26px] flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="bg-mint-300 text-ink min-h-[34px] px-6 text-base font-semibold uppercase transition-colors hover:bg-mint-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 focus-visible:outline-none disabled:opacity-70"
        >
          {status === 'sending' ? 'Sending…' : 'Submit'}
        </button>
        <p aria-live="polite" className="text-sm text-white">
          {status === 'sent' ? "Thanks — we'll be in touch soon." : null}
          {status === 'failed'
            ? 'We could not send that just now. Check your connection and try again.'
            : null}
        </p>
      </div>
    </form>
  )
}
