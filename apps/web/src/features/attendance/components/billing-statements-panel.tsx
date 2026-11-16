'use client'

import { useQueryClient } from '@tanstack/react-query'
import { offerUndo } from '@/lib/undo'
import { useBillingStatements, useDeleteStatement } from '../hooks/use-statements'
import { attendanceKeys } from '../query-keys'
import type { BillingStatementRow } from '../schema'
import { reissueStatement } from '../utils/statement-output'
import { BillingStatementsTable } from './billing-statements-table'

/** The statements a contractor has issued; only they change them, an admin only reads them. */
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
      onOutput={(statement, output) => void reissueStatement(statement, output)}
      onDelete={deleteWithUndo}
      emptyHint="Save a billing statement above and it is kept here, ready to print, download or email again."
    />
  )
}
