import type { BillingStatementValues } from '../schema'
import {
  formatStatementDate,
  formatUsd,
  statementTotals,
  type StatementPeriod,
} from './billing-statement'

export interface StatementEmail {
  /** Empty leaves the recipient for the contractor to fill in their mail app. */
  to: string
  subject: string
  body: string
}

export interface EmailAttachmentFile {
  fileName: string
  contentType: string
  bytes: Uint8Array
}

export function statementEmail(
  values: BillingStatementValues,
  period: StatementPeriod,
): StatementEmail {
  const totals = statementTotals(values)
  return {
    to: values.sendTo,
    subject: `Billing statement ${values.invoiceNumber} — ${values.contractorName}`,
    body: [
      'Hi,',
      '',
      `Please find attached my billing statement for ${formatStatementDate(period.from)} – ${formatStatementDate(period.to)}.`,
      '',
      `Invoice: ${values.invoiceNumber}`,
      `Total due: ${formatUsd(totals.totalCents)} USD`,
      `Pay via Wise: ${values.wiseLink}`,
      '',
      'Thanks,',
      values.contractorName,
    ].join('\n'),
  }
}

const utf8 = new TextEncoder()

function base64(bytes: Uint8Array) {
  let binary = ''
  // Chunked, since spreading a whole PDF into one call overflows the argument limit.
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return btoa(binary)
}

// RFC 2045 caps an encoded body line at 76 characters.
function base64Body(bytes: Uint8Array) {
  return (base64(bytes).match(/.{1,76}/g) ?? []).join('\r\n')
}

/** Each RFC 2047 word stays short enough that the "Subject:" line fits in 78 characters. */
function encodeHeader(text: string) {
  if (/^[\x20-\x7e]*$/.test(text)) return text
  const words: string[] = []
  let chunk = ''
  for (const char of text) {
    if (chunk && utf8.encode(chunk + char).length > 39) {
      words.push(chunk)
      chunk = ''
    }
    chunk += char
  }
  if (chunk) words.push(chunk)
  return words.map((word) => `=?UTF-8?B?${base64(utf8.encode(word))}?=`).join('\r\n ')
}

function asciiFileName(fileName: string) {
  return fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '')
}

/**
 * A MIME message marked unsent, which Outlook and Apple Mail open as a draft ready to send
 * rather than as a received email.
 */
export function statementEml(email: StatementEmail, attachment: EmailAttachmentFile) {
  const boundary = `ihp-${crypto.randomUUID()}`
  const name = asciiFileName(attachment.fileName)
  const fullName = encodeURIComponent(attachment.fileName)

  return [
    'X-Unsent: 1',
    ...(email.to ? [`To: ${email.to}`] : []),
    `Subject: ${encodeHeader(email.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(utf8.encode(email.body.replaceAll('\n', '\r\n'))),
    '',
    `--${boundary}`,
    `Content-Type: ${attachment.contentType};`,
    ` name="${name}"`,
    'Content-Disposition: attachment;',
    ` filename="${name}";`,
    ` filename*=UTF-8''${fullName}`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(attachment.bytes),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}
