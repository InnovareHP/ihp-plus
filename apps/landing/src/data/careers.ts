export interface OpenRole {
  slug: string
  title: string
  summary: string
  team: string | null
  employmentType: string
  workplace: string
  location: string | null
  pay: string | null
  closesAt: string | null
  url: string
}

export interface CareersList {
  roles: OpenRole[]
  careersUrl: string
  // False when the portal was unreachable, so the page links there instead.
  fetched: boolean
}

// Origin only: a pasted `.../app` is trimmed, since the paths below already carry the basePath.
export const PORTAL_URL = (
  import.meta.env.PORTAL_URL ?? 'https://portal.ihpplusglobal.com'
).replace(/\/(app\/?)?$/, '')

const TIMEOUT_MS = 8000

// A slow or down portal must never fail the site's build, so any failure yields an empty list.
export async function fetchOpenRoles(): Promise<CareersList> {
  const careersUrl = `${PORTAL_URL}/app/careers`
  try {
    const response = await fetch(`${PORTAL_URL}/app/api/careers`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as { roles?: OpenRole[]; careersUrl?: string }
    return {
      roles: Array.isArray(body.roles) ? body.roles : [],
      careersUrl: body.careersUrl ?? careersUrl,
      fetched: true,
    }
  } catch (error) {
    console.warn(`[careers] could not read open roles from ${PORTAL_URL}:`, error)
    return { roles: [], careersUrl, fetched: false }
  }
}
