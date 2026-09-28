/** A readable URL segment with a short random tail, so two postings with one title never collide. */
export function slugOf(title: string, seed: string) {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  const tail = seed
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toLowerCase()
  return words ? `${words}-${tail}` : `job-${tail}`
}
