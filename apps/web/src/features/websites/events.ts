import type { EventName } from '@/lib/analytics'

export const websiteEvents = {
  roundStarted: 'websites.round.started',
  roundCompleted: 'websites.round.completed',
  roundFailed: 'websites.round.failed',
  checkRecorded: 'websites.check.recorded',
  checkRecordFailed: 'websites.check.record_failed',
  created: 'websites.website.created',
  createFailed: 'websites.website.create_failed',
  updated: 'websites.website.updated',
  updateFailed: 'websites.website.update_failed',
  archived: 'websites.website.archived',
  archiveFailed: 'websites.website.archive_failed',
  exported: 'websites.month.exported',
  exportFailed: 'websites.month.export_failed',
  itTeamSaved: 'websites.settings.it_team_saved',
  itTeamSaveFailed: 'websites.settings.it_team_save_failed',
} as const satisfies Record<string, EventName>
