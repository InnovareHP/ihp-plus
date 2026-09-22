'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { track } from '@/lib/analytics'
import { uploadSelfie } from '../actions'
import { attendanceEvents } from '../events'

const CAMERA_DENIED = 'The camera is blocked — allow it in your browser, then take the photo again.'

export interface SelfieCamera {
  /** A data URL once a photo is taken, so the person sees what is about to be sent. */
  preview: string | undefined
  problem: string | undefined
  isReady: boolean
  isUploading: boolean
  take: () => void
  retake: () => void
  confirm: () => Promise<string | undefined>
}

/**
 * The camera is a browser device, not React state: the stream is opened and closed by hand. The
 * element's ref belongs to the caller so nothing here is read through a ref during render.
 */
export function useSelfie(
  active: boolean,
  videoRef: RefObject<HTMLVideoElement | null>,
): SelfieCamera {
  const streamRef = useRef<MediaStream | null>(null)
  const [preview, setPreview] = useState<string | undefined>(undefined)
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const [isReady, setIsReady] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Synchronises the camera device with whether the panel is open.
  useEffect(() => {
    let cancelled = false

    function stop() {
      streamRef.current?.getTracks().forEach((device) => device.stop())
      streamRef.current = null
      setIsReady(false)
    }

    if (!active) {
      stop()
      return
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((device) => device.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setIsReady(true)
      })
      .catch(() => {
        if (!cancelled) setProblem(CAMERA_DENIED)
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [active, videoRef])

  const take = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      setProblem('The camera is not ready yet — try again in a moment.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    setProblem(undefined)
    setPreview(canvas.toDataURL('image/jpeg', 0.7))
  }, [videoRef])

  const retake = useCallback(() => {
    setPreview(undefined)
    setProblem(undefined)
  }, [])

  const confirm = useCallback(async () => {
    if (!preview) return undefined

    setIsUploading(true)
    try {
      const blob = await (await fetch(preview)).blob()
      const body = new FormData()
      body.append('file', new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))

      const result = await uploadSelfie(body)
      if (!result.ok) {
        track(attendanceEvents.selfieFailed, { reason: result.message })
        setProblem(result.message)
        return undefined
      }

      track(attendanceEvents.selfieCaptured)
      return result.key
    } finally {
      setIsUploading(false)
    }
  }, [preview])

  return { preview, problem, isReady, isUploading, take, retake, confirm }
}
