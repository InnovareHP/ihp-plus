'use client'

import { useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { offerUndo } from '@/lib/undo'
import { attendanceEvents } from '../events'
import { useBillingStatements, useDeleteStatement } from '../hooks/use-statements'
import { attendanceKeys } from '../query-keys'
import type { BillingStatementRow } from '../schema'
import { billingStatementHtml, printHtml } from '../utils/billing-statement'
import { BillingStatementsTable } from './billing-statements-table'

export interface BillingStatementsPanelProps {
  /** An admin's view of every contractor's statements, read-only. */
  everyone?: boolean
}

function reprint(statement: BillingStatementRow) {
  try {
    printHtml(
      billingStatementHtml(statement, { from: statement.periodStart, to: statement.periodEnd }),
    )
    track(attendanceEvents.statementPrinted, { days: statement.daysWorked, reprint: true })
  } catch (error) {
    track(attendanceEvents.statementPrintFailed, {
      reason: error instanceof Error ? error.message : 'unknown',
    })
    announceFailure('Could not open the print view — allow printing for this site and try again.')
  }
}

/** The statements a contractor has issued, or, for an admin, everyone's. */
export function BillingStatementsPanel({ everyone = false }: BillingStatementsPanelProps) {
  const statements = useBillingStatements(everyone)
  const remove = useDeleteStatement()
  const queryClient = useQueryClient()
  const key = attendanceKeys.statementList(false)

  function deleteWithUndo(statement: BillingStatementRow) {
    // Undo over confirm: the row goes at once, and the server is told when the toast closes.
    const previous = queryClient.getQueryData<BillingStatementRow[]>(key)
    queryClient.setQueryData<BillingStatementRow[]>(key, (rows) =>
      rows?.filter((row) => row.id !== statement.id),
    )
    offerUndo({
      message: `Deleted ${statement.invoiceNumber}`,
      undoLabel: 'Undo',
      onUndo: () => queryClient.setQueryData(key, previous),
      onCommit: () => remove.mutate({ statementId: statement.id }),
    })
  }

  return (
    <BillingStatementsTable
      title={everyone ? 'Billing statements' : 'Your billing statements'}
      statements={statements.data}
      isPending={statements.isPending}
      isError={statements.isError}
      isFetching={statements.isFetching}
      onRetry={() => void statements.refetch()}
      onPrint={reprint}
      onDelete={everyone ? undefined : deleteWithUndo}
      showContractor={everyone}
      emptyHint={
        everyone
          ? 'Statements contractors print from their time clock are kept here.'
          : 'Print a billing statement above and it is kept here, ready to print again.'
      }
    />
  )
}
