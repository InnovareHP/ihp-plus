import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { LOGO_CONTENT_ID, LOGO_PNG_BASE64 } from './logo'
import type { PreparedEmail } from './templates'

export interface OutboundEmail extends PreparedEmail {
  to: string
}

interface SesConfig {
  region: string
  from: string
  replyTo: string | undefined
  /** A configuration set is what routes SES's bounce and complaint events somewhere. */
  configurationSet: string | undefined
  credentials: { accessKeyId: string; secretAccessKey: string } | undefined
}

function readConfig(): SesConfig | null {
  const from = process.env.EMAIL_FROM
  if (!from) return null

  const accessKeyId = process.env.SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY

  return {
    region: process.env.SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
    from,
    replyTo: process.env.EMAIL_REPLY_TO,
    configurationSet: process.env.SES_CONFIGURATION_SET,
    // Absent keys are not an error: on ECS or Lambda the SDK resolves the task role instead,
    // which is the better arrangement because nothing long-lived sits in the environment.
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  }
}

let cached: { config: SesConfig; client: SESv2Client } | undefined

let logo: Uint8Array | undefined

function logoBytes() {
  logo ??= Uint8Array.from(Buffer.from(LOGO_PNG_BASE64, 'base64'))
  return logo
}

// Built on first send rather than at import: a build must not require mail credentials.
function connect(config: SesConfig) {
  cached ??= {
    config,
    client: new SESv2Client({ region: config.region, credentials: config.credentials }),
  }
  return cached.client
}

export function isEmailConfigured() {
  return readConfig() !== null
}

/**
 * Sends one message, or logs it when EMAIL_FROM is unset so local development needs no AWS
 * account. Never throws: a caller is mid-signup or mid-invite, and a mail provider having a
 * bad minute must not fail the thing the user actually asked for.
 */
export async function sendEmail({ to, subject, html, text }: OutboundEmail) {
  const config = readConfig()

  if (!config) {
    console.warn(`[email:unsent] to=${to} subject="${subject}"\n${text}`)
    return { delivered: false as const, reason: 'not-configured' as const }
  }

  try {
    await connect(config).send(
      new SendEmailCommand({
        FromEmailAddress: config.from,
        Destination: { ToAddresses: [to] },
        ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
        ConfigurationSetName: config.configurationSet,
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: html, Charset: 'UTF-8' },
              Text: { Data: text, Charset: 'UTF-8' },
            },
            // Every layout references the logo by content id, so it travels with every message.
            Attachments: [
              {
                FileName: 'innovare-logo.png',
                ContentType: 'image/png',
                ContentDisposition: 'INLINE',
                ContentId: LOGO_CONTENT_ID,
                ContentTransferEncoding: 'BASE64',
                RawContent: logoBytes(),
              },
            ],
          },
        },
      }),
    )
    return { delivered: true as const }
  } catch (error) {
    // Logged rather than rethrown, and without the body: a failed send is an operational
    // problem, not something the person signing up can act on.
    console.error(
      `[email:failed] to=${to} subject="${subject}"`,
      error instanceof Error ? error.message : error,
    )
    return { delivered: false as const, reason: 'send-failed' as const }
  }
}
