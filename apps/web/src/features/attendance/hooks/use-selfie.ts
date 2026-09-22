'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { track } from '@/lib/analytics'
import { uploadSelfie } from '../actions'
import { attendanceEvents } from '../events'
import { extensionFor, selfieProblem } from '../schema'

const CAMERA_DENIED =
  'This browser will not open the camera. Choose a photo instead, or ask an admin to record the day for you.'

export interface SelfieCamera {
  /** A data URL once a photo is taken, so the person sees what is about to be sent. */
  preview: string | undefined
  problem: string | undefined
  isReady: boolean
  /** False once the camera has refused, which is what puts the file picker on screen. */
  hasCamera: boolean
  isUploading: boolean
  take: () => void
  choose: (file: File | null) => void
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
  const [hasCamera, setHasCamera] = useState(true)
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

    // No mediaDevices at all is an insecure origin or an old browser, which lands in the same
    // place as a refusal: the file picker.
    const camera =
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false }) ??
      Promise.reject(new Error('This browser has no camera API.'))

    camera
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
        if (cancelled) return
        setProblem(CAMERA_DENIED)
        setHasCamera(false)
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

  /**
   * The way back in when the camera will not open: a file the person picks, which on a phone is
   * the camera anyway. A photo is still required — the rule holds, the lockout does not.
   */
  const choose = useCallback((file: File | null) => {
    if (!file) return

    const problem = selfieProblem(file)
    if (problem) {
      setProblem(problem)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setProblem(undefined)
      setPreview(typeof reader.result === 'string' ? reader.result : undefined)
    }
    reader.onerror = () => setProblem('Could not read that photo — pick another.')
    reader.readAsDataURL(file)
  }, [])

  const retake = useCallback(() => {
    setPreview(undefined)
    setProblem(undefined)
  }, [])

  const confirm = useCallback(async () => {
    if (!preview) return undefined

    setIsUploading(true)
    try {
      const blob = await (await fetch(preview)).blob()
      const type = blob.type || 'image/jpeg'
      const body = new FormData()
      body.append('file', new File([blob], `selfie.${extensionFor(type)}`, { type }))

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

  return { preview, problem, isReady, hasCamera, isUploading, take, choose, retake, confirm }
}
