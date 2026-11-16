import type {
  AttendanceAbsenceRow,
  AttendanceDayRow,
  BillingStatementRow,
  EmployeeSummaryRow,
  SummaryTaskRow,
} from '../schema'
import { timeWorked } from './billing-statement'
import type { KpiPerson } from './daily-task-kpis'

export interface SummaryTaskInput extends SummaryTaskRow {
  assigneeIds: readonly string[]
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return groups
}

/** Days and hours use the same rule as the statement form, so the two always agree. */
export function employeeSummaries(input: {
  people: readonly KpiPerson[]
  days: readonly AttendanceDayRow[]
  absences: readonly AttendanceAbsenceRow[]
  tasks: readonly SummaryTaskInput[]
  statements: readonly BillingStatementRow[]
}): EmployeeSummaryRow[] {
  const days = groupBy(input.days, (day) => day.userId)
  const absences = groupBy(input.absences, (absence) => absence.userId)
  const statements = groupBy(input.statements, (statement) => statement.userId)

  return input.people.map((person) => {
    const { daysWorked, hoursWorked, paidDaysOff } = timeWorked(
      days.get(person.userId) ?? [],
      absences.get(person.userId) ?? [],
    )
    return {
      ...person,
      daysWorked,
      hoursWorked,
      paidDaysOff,
      tasks: input.tasks
        .filter((task) => task.assigneeIds.includes(person.userId))
        .map(({ id, name, dueDate, isDone }) => ({ id, name, dueDate, isDone }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      statements: statements.get(person.userId) ?? [],
    }
  })
}
