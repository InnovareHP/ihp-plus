'use client'

import { Button } from '@mantine/core'
import { IconFileInvoice } from '@tabler/icons-react'
import { useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useBillingStatements } from '../hooks/use-statements'
import type { AttendanceAbsenceRow, AttendanceDayRow } from '../schema'
import { defaultInvoiceNumber, timeWorked } from '../utils/billing-statement'
import { BillingStatementModal } from './billing-statement-modal'

export interface BillingStatementButtonProps {
  days: readonly AttendanceDayRow[] | undefined
  absences: readonly AttendanceAbsenceRow[] | undefined
  from: string
  to: string
  /** Today in the company zone, the statement's default invoice date. */
  today: string
}

/** Opens the statement form for the range on screen, seeded from the timesheet. */
export function BillingStatementButton({
  days,
  absences,
  from,
  to,
  today,
}: BillingStatementButtonProps) {
  const session = useSession()
  // The newest statement carries the rate and link that rarely change between periods.
  const latest = useBillingStatements().data?.[0]
  // Whether the form is open is a disclosure nothing else reads.
  const [opened, setOpened] = useState(false)
  const { paidDaysOff, ...worked } = timeWorked(days ?? [], absences ?? [])

  return (
    <>
      <Button
        variant="default"
        leftSection={<IconFileInvoice size={18} />}
        onClick={() => setOpened(true)}
        disabled={days === undefined}
      >
        Billing statement
      </Button>
      {opened ? (
        <BillingStatementModal
          opened
          onClose={() => setOpened(false)}
          period={{ from, to }}
          paidDaysOff={paidDaysOff}
          initial={{
            contractorName: session.data?.user.name ?? '',
            position: latest?.position ?? '',
            invoiceNumber: defaultInvoiceNumber(to),
            invoiceDate: today,
            ...worked,
            dailyRateCents: latest?.dailyRateCents ?? 0,
            bonusCents: 0,
            expenses: [],
            wiseLink: latest?.wiseLink ?? '',
          }}
        />
      ) : null}
    </>
  )
}
