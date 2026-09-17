/**
 * A link share needs no sign-in, so nothing ties it to a person: anyone holding the URL is the
 * holder of the access. Guest sharing stays the default for exactly that reason.
 */
export function sharesByLink() {
  return process.env.GRAPH_SHARE_MODE === 'link'
}

/** An expiry bounds a link nobody can be asked to give back; unset means it never lapses. */
export function linkExpiry(now = new Date()) {
  const days = Number(process.env.GRAPH_LINK_EXPIRY_DAYS)
  if (!Number.isFinite(days) || days <= 0) return undefined
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}
