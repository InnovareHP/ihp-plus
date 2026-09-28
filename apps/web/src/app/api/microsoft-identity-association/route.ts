import { NextResponse } from 'next/server'

// Served at the bare origin by the vercel.json rewrite; read per request so it names the live app.
export const dynamic = 'force-dynamic'

export function GET() {
  const applicationId = process.env.MICROSOFT_CLIENT_ID
  if (!applicationId) {
    return NextResponse.json({ error: 'Microsoft sign-in is not configured.' }, { status: 404 })
  }
  return NextResponse.json({ associatedApplications: [{ applicationId }] })
}
