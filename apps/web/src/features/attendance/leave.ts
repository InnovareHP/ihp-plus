import type { Prisma } from '@ihp/db'

export interface LeaveBooking {
  organizationId: string
  userId: string
  /** Shown on the timesheet, so it is the form's name: "Vacation leave". */
  name: string
  submissionId: string
  dates: readonly string[]
}

/**
 * Books approved time off on the clock, inside the caller's transaction so a decision is never
 * saved without its days. A day already booked by an overlapping approval is kept as it was.
 */
export async function bookLeave(tx: Prisma.TransactionClient, booking: LeaveBooking) {
  if (booking.dates.length === 0) return

  await tx.attendanceLeave.createMany({
    data: booking.dates.map((date) => ({
      organizationId: booking.organizationId,
      userId: booking.userId,
      date: new Date(`${date}T00:00:00.000Z`),
      name: booking.name,
      submissionId: booking.submissionId,
    })),
    skipDuplicates: true,
  })
}
