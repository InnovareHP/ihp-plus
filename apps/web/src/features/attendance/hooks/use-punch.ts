'use client'

import { useClockIn, useClockOut } from './use-time-clock'
import type { AttendanceShiftRow, DailyPlan } from '../schema'
import { currentLocation } from '../utils/location'
import { track } from '@/lib/analytics'
import { attendanceEvents } from '../events'

export type PunchKind = 'in' | 'out'

export interface Punch {
  /** True when the company asks for a photo, so the caller shows the camera first. */
  needsSelfie: boolean
  isPending: boolean
  /** Resolves true when the day moved; the mutation announces its own failure. */
  punch: (
    which: PunchKind,
    input: { selfieKey?: string; note?: string; plan?: DailyPlan },
  ) => Promise<boolean>
}

/** The mechanics behind both clocks — the card on the page and the chip in the header. */
export function usePunch(shift: AttendanceShiftRow | undefined): Punch {
  const clockIn = useClockIn()
  const clockOut = useClockOut()

  async function punch(
    which: PunchKind,
    input: { selfieKey?: string; note?: string; plan?: DailyPlan },
  ) {
    const location = shift?.captureLocation ? await currentLocation() : ''
    const values = {
      selfieKey: input.selfieKey ?? '',
      location,
      note: input.note?.trim() ?? '',
      dailyTasks: input.plan?.dailyTasks ?? [],
      carriedTaskIds: input.plan?.carriedTaskIds ?? [],
      doneTaskIds: input.plan?.doneTaskIds ?? [],
      droppedTaskIds: input.plan?.droppedTaskIds ?? [],
    }

    try {
      if (which === 'in') {
        await clockIn.mutateAsync(values)
        track(attendanceEvents.dailyTasksPlanned, {
          count: values.dailyTasks.length,
          carried: values.carriedTaskIds.length,
          done: values.doneTaskIds.length,
          dropped: values.droppedTaskIds.length,
        })
      } else await clockOut.mutateAsync(values)
      return true
    } catch {
      // The mutation announced the reason; the caller keeps whatever the person typed.
      return false
    }
  }

  return {
    needsSelfie: Boolean(shift?.requireSelfie),
    isPending: clockIn.isPending || clockOut.isPending,
    punch,
  }
}
