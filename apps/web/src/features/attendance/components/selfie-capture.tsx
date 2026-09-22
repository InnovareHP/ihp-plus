'use client'

import { Button, Group, Image, Paper, Stack, Text } from '@mantine/core'
import { useRef } from 'react'
import { useSelfie } from '../hooks/use-selfie'

export interface SelfieCaptureProps {
  /** What the photo is for, so the heading reads "Selfie for clocking in". */
  purpose: string
  onCaptured: (selfieKey: string) => void
  onCancel: () => void
}

/** The camera step in front of a punch, shown only where the company asks for a selfie. */
export function SelfieCapture({ purpose, onCaptured, onCancel }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const camera = useSelfie(true, videoRef)

  async function use() {
    const key = await camera.confirm()
    if (key) onCaptured(key)
  }

  return (
    <Paper withBorder p="md" radius="md" component="section" aria-label={`Selfie for ${purpose}`}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Your company asks for a photo at the clock. It is kept with this day only.
        </Text>

        {camera.preview ? (
          <Image src={camera.preview} alt="The selfie you just took" radius="md" mah={260} />
        ) : (
          // Muted and inline so no browser blocks it and nothing plays out loud.
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Camera preview"
            style={{ width: '100%', maxHeight: 260, borderRadius: 8, objectFit: 'cover' }}
          />
        )}

        {camera.problem ? (
          <Text size="sm" c="red" role="alert">
            {camera.problem}
          </Text>
        ) : null}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          {camera.preview ? (
            <>
              <Button variant="default" onClick={camera.retake} disabled={camera.isUploading}>
                Retake
              </Button>
              <Button onClick={use} loading={camera.isUploading}>
                {camera.isUploading ? 'Sending…' : `Use photo and ${purpose}`}
              </Button>
            </>
          ) : (
            <Button onClick={camera.take} disabled={!camera.isReady}>
              Take photo
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  )
}
