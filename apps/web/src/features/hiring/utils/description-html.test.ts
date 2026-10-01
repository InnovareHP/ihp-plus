import { describe, expect, it } from 'vitest'
import { descriptionText, descriptionToHtml } from './description-html'
import { sanitizeDescription } from './sanitize-description'

describe('descriptionToHtml', () => {
  it('turns a plain-text description into paragraphs and keeps its line breaks', () => {
    expect(descriptionToHtml('You will care for patients.\n\n- Nights\n- Weekends')).toBe(
      '<p>You will care for patients.</p><p>- Nights<br>- Weekends</p>',
    )
  })

  it('escapes markup typed into the old plain-text box', () => {
    expect(descriptionToHtml('Pay is 5 < 10 & rising')).toBe('<p>Pay is 5 &lt; 10 &amp; rising</p>')
  })

  it('leaves editor HTML alone', () => {
    expect(descriptionToHtml('<ul><li>Nights</li></ul>')).toBe('<ul><li>Nights</li></ul>')
  })
})

describe('descriptionText', () => {
  it('counts the words, not the markup', () => {
    expect(descriptionText('<p></p><ul><li><p>Nights &amp; weekends</p></li></ul>')).toBe(
      'Nights & weekends',
    )
  })
})

describe('sanitizeDescription', () => {
  it('keeps formatting and lists', () => {
    const html =
      '<h2>The role</h2><p><strong>Bold</strong> <em>and</em> <u>more</u></p><ol><li>One</li></ol>'
    expect(sanitizeDescription(html)).toBe(html)
  })

  it('strips scripts, handlers and javascript links', () => {
    expect(
      sanitizeDescription(
        '<p onclick="steal()">Hi<script>steal()</script></p><a href="javascript:steal()">x</a>',
      ),
    ).toBe('<p>Hi</p><a target="_blank" rel="noopener noreferrer nofollow">x</a>')
  })

  it('opens links in a new tab without handing the careers page to the destination', () => {
    expect(sanitizeDescription('<p><a href="https://example.com">Benefits</a></p>')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">Benefits</a></p>',
    )
  })
})
