'use client'

import { useQueryClient } from '@tanstack/react-query'
import { announceFailure, announceSuccess } from '@/lib/announce'
import { offerUndo } from '@/lib/undo'
import { useBillingStatements, useDeleteStatement } from '../hooks/use-statements'
import { attendanceKeys } from '../query-keys'
import type { BillingStatementRow } from '../schema'
import { statementFileName } from '../utils/billing-statement'
import { deliverStatement, type StatementOutput } from '../utils/statement-output'
import { BillingStatementsTable } from './billing-statements-table'

const FAILED: Record<StatementOutput, string> = {
  print: 'Could not open the print view — allow printing for this site and try again.',
  pdf: 'Could not create the PDF — try again.',
  email: 'Could not create the email draft — try again.',
}

async function reissue(statement: BillingStatementRow, output: StatementOutput) {
  const period = { from: statement.periodStart, to: statement.periodEnd }
  if (!(await deliverStatement(output, statement, period, true))) {
    announceFailure(FAILED[output])
    return
  }
  // The print dialog speaks for itself; a download lands silently, so it is announced.
  if (output === 'pdf') announceSuccess(`Downloaded ${statementFileName(statement)}.pdf.`)
  if (output === 'email')
    announceSuccess('Email draft downloaded — open it to check it and send it.')
}

/** The statements a contractor has issued; they are private, so nobody else can list them. */
export function BillingStatementsPanel() {
  const statements = useBillingStatements()
  const remove = useDeleteStatement()
  const queryClient = useQueryClient()
  const key = attendanceKeys.statementList()

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
      title="Your billing statements"
      statements={statements.data}
      isPending={statements.isPending}
      isError={statements.isError}
      isFetching={statements.isFetching}
      onRetry={() => void statements.refetch()}
      onOutput={(statement, output) => void reissue(statement, output)}
      onDelete={deleteWithUndo}
      emptyHint="Save a billing statement above and it is kept here, ready to print, download or email again."
    />
  )
}
