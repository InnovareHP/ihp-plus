import { NextResponse } from 'next/server'
import { loadCareers } from '@/features/hiring/public-service'
import { EMPLOYMENT_TYPE_LABELS, salaryLabel, WORKPLACE_LABELS } from '@/features/hiring/schema'
import { portalUrl } from '@/lib/email'
import { careersPostingRoute, routes } from '@/lib/routes'

// Read per request: the marketing site builds its careers page from this, and must see today's list.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const careers = await loadCareers()
    if (!careers) {
      return NextResponse.json({ error: 'No organization is set up yet.' }, { status: 404 })
    }

    return NextResponse.json(
      {
        organizationName: careers.organizationName,
        careersUrl: portalUrl(routes.careers),
        roles: careers.postings.map((posting) => ({
          slug: posting.slug,
          title: posting.title,
          summary: posting.summary,
          team: posting.teamName ?? null,
          employmentType: EMPLOYMENT_TYPE_LABELS[posting.employmentType],
          workplace: WORKPLACE_LABELS[posting.workplace],
          location: posting.location || null,
          pay: salaryLabel(posting) ?? null,
          closesAt: posting.closesAt ?? null,
          url: portalUrl(careersPostingRoute(posting.slug)),
        })),
      },
      // A build fetches it once; a minute of caching only spares a burst of rebuilds.
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    )
  } catch (error) {
    console.error('[careers] could not list open roles', error)
    return NextResponse.json({ error: 'Could not list the open roles.' }, { status: 500 })
  }
}
