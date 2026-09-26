'use client'

import { Button } from '@mantine/core'
import { IconFileInvoice } from '@tabler/icons-react'
import { useState } from 'react'
import { useSession } from '@/lib/auth-client'
import type { AttendanceDayRow } from '../schema'
import { defaultInvoiceNumber, timeWorked } from '../utils/billing-statement'
import { BillingStatementModal } from './billing-statement-modal'

export interface BillingStatementButtonProps {
  days: readonly AttendanceDayRow[] | undefined
  from: string
  to: string
  /** Today in the company zone, the statement's default invoice date. */
  today: string
}

/** Opens the statement form for the range on screen, seeded from the timesheet. */
export function BillingStatementButton({ days, from, to, today }: BillingStatementButtonProps) {
  const session = useSession()
  // Whether the form is open is a disclosure nothing else reads.
  const [opened, setOpened] = useState(false)
  const worked = timeWorked(days ?? [])

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
          initial={{
            contractorName: session.data?.user.name ?? '',
            position: '',
            invoiceNumber: defaultInvoiceNumber(to),
            invoiceDate: today,
            ...worked,
            dailyRateCents: 0,
            bonusCents: 0,
            expenses: [],
            wiseLink: '',
          }}
        />
      ) : null}
    </>
  )
}
