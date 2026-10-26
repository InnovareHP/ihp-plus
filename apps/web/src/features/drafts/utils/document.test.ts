import { describe, expect, it } from 'vitest'
import { hideLocked, missingFields, parseDocument, restoreLocked } from './document'
import { CONTRACT_TEMPLATE } from './templates'

const BODY = `# Agreement

Made with {{client_name}} on
{{effective_date}}.

## Scope

- {{service}}
- Monthly report

[locked]
## Confidentiality

Keep it private.
[/locked]`

describe('parseDocument', () => {
  it('reads titles, headings, joined paragraphs, bullets and locked runs', () => {
    expect(parseDocument(BODY)).toEqual([
      { kind: 'title', text: 'Agreement', locked: false },
      {
        kind: 'paragraph',
        text: 'Made with _______ on {{effective_date}}.',
        locked: false,
      },
      { kind: 'heading', text: 'Scope', locked: false },
      { kind: 'bullet', text: '{{service}}', locked: false },
      { kind: 'bullet', text: 'Monthly report', locked: false },
      { kind: 'heading', text: 'Confidentiality', locked: true },
      { kind: 'paragraph', text: 'Keep it private.', locked: true },
    ])
  })
})

describe('missingFields', () => {
  it('names each required placeholder once and skips optional client details', () => {
    expect(missingFields(`${BODY} {{service}} {{client_address}}`)).toEqual([
      'effective_date',
      'service',
    ])
    expect(missingFields('All filled in.')).toEqual([])
  })
})

describe('hideLocked and restoreLocked', () => {
  it('swaps each locked section for a token and puts the exact wording back', () => {
    const { text, sections } = hideLocked(BODY)

    expect(sections).toHaveLength(1)
    expect(text).not.toContain('Keep it private.')
    expect(text).toContain('[locked section 1]')
    expect(restoreLocked(text.replace('{{client_name}}', 'Acme'), sections)).toBe(
      BODY.replace('{{client_name}}', 'Acme'),
    )
  })

  it('refuses a reply that dropped, repeated or invented a token', () => {
    const { text, sections } = hideLocked(BODY)

    expect(restoreLocked('# Agreement', sections)).toBeUndefined()
    expect(
      restoreLocked(
        `${text}

[locked section 1]`,
        sections,
      ),
    ).toBeUndefined()
    expect(
      restoreLocked(
        `${text}

[locked section 2]`,
        sections,
      ),
    ).toBeUndefined()
  })

  it('round-trips the contract template as written', () => {
    const { text, sections } = hideLocked(CONTRACT_TEMPLATE.body)
    expect(sections.length).toBeGreaterThan(0)
    expect(restoreLocked(text, sections)).toBe(CONTRACT_TEMPLATE.body)
  })
})
