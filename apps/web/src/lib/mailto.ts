/** Hands a mailto link to the system's mail app without leaving the page. */
export function openMailto(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
}
