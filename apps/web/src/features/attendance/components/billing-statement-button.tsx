'use client'

import { Button } from '@mantine/core'
import { IconFileInvoice } from '@tabler/icons-react'
import { useState } from 'react'
import { useBillingStatements, useStatementDefaults } from '../hooks/use-statements'
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
  const defaults = useStatementDefaults()
  // The newest statement carries the rate and link that rarely change between periods.
  const latest = useBillingStatements().data?.[0]
  // A rate billed on the other basis would be wrong by a factor of the days, so it is not reused.
  const lastRate = latest && latest.fixedPay === defaults.data?.fixedPay ? latest.dailyRateCents : 0
  // Whether the form is open is a disclosure nothing else reads.
  const [opened, setOpened] = useState(false)
  const { paidDaysOff, ...worked } = timeWorked(days ?? [], absences ?? [])

  return (
    <>
      <Button
        variant="default"
        leftSection={<IconFileInvoice size={18} />}
        onClick={() => setOpened(true)}
        disabled={days === undefined || !defaults.data}
      >
        Billing statement
      </Button>
      {opened && defaults.data ? (
        <BillingStatementModal
          opened
          onClose={() => setOpened(false)}
          period={{ from, to }}
          paidDaysOff={paidDaysOff}
          initial={{
            ...defaults.data,
            invoiceNumber: defaultInvoiceNumber(to),
            invoiceDate: today,
            ...worked,
            dailyRateCents: lastRate,
            bonusCents: 0,
            expenses: [],
            wiseLink: latest?.wiseLink ?? '',
          }}
        />
      ) : null}
    </>
  )
}
