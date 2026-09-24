/**
 * One branded shell every transactional email renders into.
 *
 * Written as tables with inline styles on purpose: Outlook renders with Word's engine, which
 * has no flexbox, no grid and drops most of a <style> block, so anything structural has to be
 * a table attribute and anything visual has to be on the element itself.
 */

import { LOGO_CONTENT_ID } from './logo'

// The brand palette as sRGB hex — no email client resolves the OKLCH ramps in theme.ts.
const BRAND = '#1346c5'
const BRAND_DARK = '#0b286b'
const INK = '#222222'
const MUTED = '#616161'
const BORDER = '#e3e3e3'
const CANVAS = '#f7f9fc'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Sent inline rather than linked: Outlook blocks remote images by default, and a linked PNG
// only exists where the landing site is served on the same origin.
const LOGO_SRC = `cid:${LOGO_CONTENT_ID}`

export interface EmailLayout {
  /** Shown in the inbox preview line, so a reader knows what it is before opening it. */
  preheader: string
  heading: string
  /** Sentences, rendered as separate paragraphs. */
  body: readonly string[]
  /** An ordered how-to, rendered as a numbered list between the body and the button. */
  steps?: readonly string[]
  action?: { label: string; url: string }
  /** Follows the button, e.g. how long the link lasts. */
  footnote?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A link's text is the URL itself, so the escaping has to hold in an attribute too — a raw
 * ampersand in a query string would otherwise close it.
 */
function button(label: string, url: string) {
  const href = escapeHtml(url)
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" bgcolor="${BRAND}" style="border-radius:6px;">
        <a href="${href}" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${MUTED};">
    If the button does not work, paste this into your browser:
  </p>
  <p style="margin:0 0 8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;color:${BRAND_DARK};word-break:break-all;">
    ${href}
  </p>`
}

export function renderEmail(layout: EmailLayout) {
  const paragraphs = layout.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:${INK};">${escapeHtml(line)}</p>`,
    )
    .join('\n')

  const steps = layout.steps?.length
    ? `<ol style="margin:0 0 16px;padding-left:24px;font-family:${FONT};font-size:15px;line-height:24px;color:${INK};">
${layout.steps.map((step) => `<li style="margin:0 0 8px;">${escapeHtml(step)}</li>`).join('\n')}
</ol>`
    : ''

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(layout.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
  <!-- Hidden preview line: without it the client previews the first visible words instead. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(layout.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
          <tr>
            <td style="padding:24px 32px 0;">
              <!-- The alt text stands in for the lockup when a client blocks images. -->
              <img src="${LOGO_SRC}" width="66" height="40" alt="IHP+" style="display:block;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:17px;font-weight:700;color:${BRAND};">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:30px;font-weight:650;color:${INK};">${escapeHtml(layout.heading)}</h1>
              ${paragraphs}
              ${steps}
              ${layout.action ? button(layout.action.label, layout.action.url) : ''}
              ${
                layout.footnote
                  ? `<p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(layout.footnote)}</p>`
                  : ''
              }
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">
          Sent by IHP+
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  // Every message carries both parts: HTML alone is a spam signal and unreadable in a
  // text-only client, and the plain part is what a screen reader may be given.
  const text = [
    layout.heading,
    '',
    ...layout.body,
    ...(layout.steps?.length
      ? ['', ...layout.steps.map((step, index) => `${index + 1}. ${step}`)]
      : []),
    ...(layout.action ? ['', `${layout.action.label}: ${layout.action.url}`] : []),
    ...(layout.footnote ? ['', layout.footnote] : []),
    '',
    '— IHP+',
  ].join('\n')

  return { html, text }
}
