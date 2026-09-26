import type { StampedFile } from '../actions'

/** Hands the browser a file to save, through a link that is clicked once and thrown away. */
export function downloadFile(file: StampedFile) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(file.bytes)], { type: file.contentType }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = file.fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next tick: some browsers start the download only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
