import { useEffect, useRef, useState, type SubmitEvent } from 'react'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

type Field = 'name' | 'email' | 'phone' | 'message'
type Status = 'idle' | 'sending' | 'sent' | 'failed' | 'unverified'

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

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
  /** Cloudflare Turnstile site key; unset, the form renders no challenge. */
  turnstileSiteKey?: string
}

/** The contact form inside the speech bubble: a React island, since it is the page's one control. */
export function ContactForm({ endpoint, turnstileSiteKey }: ContactFormProps) {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [status, setStatus] = useState<Status>('idle')
  const widget = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)

  // Mounts Cloudflare's Turnstile widget, a non-React script, and removes it on unmount.
  useEffect(() => {
    const container = widget.current
    if (!turnstileSiteKey || !container) return
    let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT
      script.async = true
      document.head.append(script)
    }
    const mount = () => {
      widgetId.current ??= window.turnstile?.render(container, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
      })
    }
    if (window.turnstile) mount()
    else script.addEventListener('load', mount)
    return () => {
      script.removeEventListener('load', mount)
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = undefined
    }
  }, [turnstileSiteKey])

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

    const body = Object.fromEntries(new FormData(form))
    if (turnstileSiteKey && !body['cf-turnstile-response']) {
      setStatus('unverified')
      return
    }

    setStatus('sending')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(String(response.status))
      form.reset()
      setStatus('sent')
      // GA4's recommended lead event, so organic sessions can be tied to enquiries.
      window.gtag?.('event', 'generate_lead', { form: 'contact' })
    } catch {
      // Typed input stays in the fields, so a retry costs one click.
      setStatus('failed')
    } finally {
      // A Turnstile token is single-use, so every attempt needs a fresh one.
      if (widgetId.current) window.turnstile?.reset(widgetId.current)
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

      {turnstileSiteKey ? <div ref={widget} className="mt-[26px] min-h-[65px]" /> : null}

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
          {status === 'unverified'
            ? 'Wait for the security check above to finish, then send again.'
            : null}
        </p>
      </div>
    </form>
  )
}
