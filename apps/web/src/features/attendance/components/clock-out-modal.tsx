'use client'

import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNow } from '../hooks/use-now'
import { usePunch } from '../hooks/use-punch'
import type { AttendanceDayRow, AttendanceSettingsRow, AttendanceShiftRow } from '../schema'
import { formatHours, formatTimeOfDay } from '@ihp/clock'
import { liveBreakSeconds, liveWorkedSeconds } from '../utils/day'
import { SelfieCapture } from './selfie-capture'

export interface ClockOutModalProps {
  opened: boolean
  onClose: () => void
  day: AttendanceDayRow
  settings: AttendanceSettingsRow
  shift: AttendanceShiftRow
}

interface NoteForm {
  note: string
}

/**
 * Clocking out ends the day, and only an admin can reopen one, so the header asks first —
 * the one place in this feature where a confirm beats an undo.
 */
export function ClockOutModal({ opened, onClose, day, settings, shift }: ClockOutModalProps) {
  const punch = usePunch(shift)
  const [takingSelfie, setTakingSelfie] = useState(false)
  // The summary keeps counting while the person decides, so the hours it quotes stay true.
  const now = useNow(opened && day.isOpen)

  const {
    register,
    getValues,
    setError,
    formState: { errors },
  } = useForm<NoteForm>({ defaultValues: { note: '' } })

  async function clockOut(selfieKey: string) {
    const note = getValues('note').trim()
    if (shift.requireNote && !note) {
      setTakingSelfie(false)
      setError('note', { message: 'Say what you worked on before clocking out.' })
      return
    }

    const done = await punch.punch('out', { selfieKey, note })
    setTakingSelfie(false)
    if (done) onClose()
  }

  function confirm() {
    if (punch.needsSelfie) {
      setTakingSelfie(true)
      return
    }
    void clockOut('')
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Clock out?" centered>
      <Stack gap="md">
        <Text size="sm">
          You have been on the clock since {formatTimeOfDay(day.clockInAt, settings.timeZone)} —{' '}
          {formatHours(liveWorkedSeconds(day, now))} worked
          {day.breaks.length > 0 ? `, ${formatHours(liveBreakSeconds(day, now))} on breaks` : ''}.
          Clocking out closes today; only an admin can reopen it.
        </Text>

        <Textarea
          label="What did you work on?"
          description={shift.requireNote ? undefined : 'Optional — it lands on today’s row.'}
          required={shift.requireNote}
          aria-required={shift.requireNote}
          error={errors.note?.message}
          errorProps={{ role: 'alert' }}
          autosize
          minRows={2}
          {...register('note')}
        />

        {takingSelfie ? (
          <SelfieCapture
            purpose="clock out"
            onCaptured={(key) => void clockOut(key)}
            onCancel={() => setTakingSelfie(false)}
          />
        ) : (
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Stay on the clock
            </Button>
            <Button color="red" loading={punch.isPending} onClick={confirm}>
              {punch.isPending ? 'Clocking out…' : 'Clock out'}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  )
}
