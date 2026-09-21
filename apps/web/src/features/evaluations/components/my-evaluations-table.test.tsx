import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import type { EvaluationRow, MyEvaluationQuery } from '../schema'
import { MyEvaluationsTable } from './my-evaluations-table'

const rpc = vi.hoisted(() => ({
  submitEvaluation: vi.fn(),
  getEvaluation: vi.fn(),
  listMyEvaluations: vi.fn(),
  listEvaluations: vi.fn(),
  assignEvaluations: vi.fn(),
  cancelEvaluation: vi.fn(),
  listCandidates: vi.fn(),
}))

vi.mock('../rpc', () => rpc)

const ROW: EvaluationRow = {
  id: 'eval-1',
  formId: 'form-1',
  formName: 'Probationary review',
  fields: [],
  values: {},
  employeeId: 'user-9',
  employeeName: 'Grace Hopper',
  employeeTeam: 'Care Management',
  employeeEmploymentStatus: 'Probationary',
  evaluatorId: 'user-1',
  evaluatorName: 'Ada Lovelace',
  status: 'pending',
  dueAt: '2026-01-31T23:59:59.999Z',
  submittedAt: undefined,
  createdAt: '2026-01-01T00:00:00.000Z',
  canFill: true,
  isMine: true,
}

const QUERY: MyEvaluationQuery = { search: '', status: 'pending', page: 1, pageSize: 25 }

function pageOf(rows: EvaluationRow[]) {
  return {
    rows,
    pageInfo: {
      page: 1,
      pageSize: 25,
      total: rows.length,
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
    },
  }
}

describe('MyEvaluationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listMyEvaluations.mockResolvedValue(pageOf([ROW]))
  })

  it('shows who is being evaluated, where they stand, and the way in', async () => {
    render(<MyEvaluationsTable query={QUERY} setQuery={vi.fn()} clearFilters={vi.fn()} />)

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('Care Management · Probationary')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Fill in the Probationary review for Grace Hopper' }),
    ).toHaveAttribute('href', '/evaluations/fill/eval-1')
  })

  it('says overdue in words, not only in colour', async () => {
    render(<MyEvaluationsTable query={QUERY} setQuery={vi.fn()} clearFilters={vi.fn()} />)

    expect(await screen.findByText('Overdue')).toBeInTheDocument()
  })

  it('offers a submitted one to read rather than to fill in again', async () => {
    rpc.listMyEvaluations.mockResolvedValue(
      pageOf([
        { ...ROW, status: 'submitted', canFill: false, submittedAt: '2026-01-10T00:00:00.000Z' },
      ]),
    )
    render(<MyEvaluationsTable query={QUERY} setQuery={vi.fn()} clearFilters={vi.fn()} />)

    expect(
      await screen.findByRole('link', { name: 'Read your Probationary review for Grace Hopper' }),
    ).toHaveAttribute('href', '/evaluations/view/eval-1')
  })

  it('says what fills the list when there is nothing to evaluate', async () => {
    rpc.listMyEvaluations.mockResolvedValue(pageOf([]))
    render(<MyEvaluationsTable query={QUERY} setQuery={vi.fn()} clearFilters={vi.fn()} />)

    expect(await screen.findByText('Nothing to evaluate right now')).toBeInTheDocument()
  })

  it('keeps an empty filter apart from an empty list', async () => {
    rpc.listMyEvaluations.mockResolvedValue(pageOf([]))
    render(
      <MyEvaluationsTable
        query={{ ...QUERY, status: 'submitted' }}
        setQuery={vi.fn()}
        clearFilters={vi.fn()}
      />,
    )

    expect(await screen.findByText('Nothing matches those filters')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <MyEvaluationsTable query={QUERY} setQuery={vi.fn()} clearFilters={vi.fn()} />,
    )
    await screen.findByText('Grace Hopper')

    expect(await axe(container)).toHaveNoViolations()
  })
})
