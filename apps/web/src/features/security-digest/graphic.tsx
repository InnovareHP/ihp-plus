import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  IconDeviceLaptop,
  IconKey,
  IconMailExclamation,
  IconShieldHeart,
  type Icon,
} from '@tabler/icons-react'
import { ImageResponse } from 'next/og'
import { DIGEST_TOPIC_LABELS, type DigestTopic } from './schema'

// Twice the 496×248 the email shows, so it stays sharp on high-density screens.
export const GRAPHIC_SIZE = { width: 992, height: 496 }

const TOPIC_ICONS: Record<DigestTopic, Icon> = {
  phishing: IconMailExclamation,
  passwords: IconKey,
  patient_data: IconShieldHeart,
  devices: IconDeviceLaptop,
}

type LoadedFont = { name: string; data: Buffer; weight: 600 | 700; style: 'normal' }

let fonts: Promise<LoadedFont[]> | undefined

// Poppins when the woff files were traced into the build; satori's bundled sans otherwise.
function brandFonts() {
  fonts ??= Promise.all(
    ([600, 700] as const).map(async (weight) => ({
      name: 'Poppins',
      weight,
      style: 'normal' as const,
      data: await readFile(
        join(
          process.cwd(),
          `node_modules/@fontsource/poppins/files/poppins-latin-${weight}-normal.woff`,
        ),
      ),
    })),
  ).catch(() => [])
  return fonts
}

/** The branded header for one issue: brand gradient, topic chip, icon and headline. */
export async function digestGraphic(issue: { topic: DigestTopic; title: string }) {
  const TopicIcon = TOPIC_ICONS[issue.topic]
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '56px 64px',
        gap: 48,
        fontFamily: 'Poppins',
        color: '#ffffff',
        // The brand gradient: bottom-left blue to top-right mint, per the guidelines.
        backgroundImage: 'linear-gradient(45deg, #0b286b 0%, #1346c5 55%, #95e5dc 100%)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 24 }}>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '8px 20px',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.16)',
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          {`Security tip · ${DIGEST_TOPIC_LABELS[issue.topic]}`}
        </div>
        <div
          style={{
            display: 'flex',
            // Long headlines step down so three lines still fit the frame.
            fontSize: issue.title.length > 48 ? 48 : 60,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {issue.title}
        </div>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, opacity: 0.85 }}>
          IHP+ IT department
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 220,
          height: 220,
          borderRadius: 48,
          backgroundColor: 'rgba(255,255,255,0.14)',
        }}
      >
        <TopicIcon size={140} stroke={1.5} color="#ffffff" />
      </div>
    </div>,
    { ...GRAPHIC_SIZE, fonts: await brandFonts() },
  )
}

/** The same picture as PNG bytes, for an inline email attachment. */
export async function digestGraphicBytes(issue: { topic: DigestTopic; title: string }) {
  try {
    return new Uint8Array(await (await digestGraphic(issue)).arrayBuffer())
  } catch (error) {
    // A missing picture must not stop the lesson going out.
    console.error('[security-digest] could not render the header picture', error)
    return undefined
  }
}
