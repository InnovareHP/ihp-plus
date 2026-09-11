import {
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconPhoto,
  IconPresentation,
  type Icon,
} from '@tabler/icons-react'

export /** A glance at the row should say what kind of file it is before the title is read. */
function fileLook(contentType: string): { Icon: Icon; color: string } {
  if (contentType === 'application/pdf') return { Icon: IconFileTypePdf, color: 'red' }
  if (contentType.includes('word')) return { Icon: IconFileTypeDoc, color: 'blue' }
  if (
    contentType.includes('sheet') ||
    contentType.includes('excel') ||
    contentType === 'text/csv'
  ) {
    return { Icon: IconFileSpreadsheet, color: 'green' }
  }
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) {
    return { Icon: IconPresentation, color: 'orange' }
  }
  if (contentType.startsWith('image/')) return { Icon: IconPhoto, color: 'grape' }
  if (contentType.startsWith('text/')) return { Icon: IconFileText, color: 'gray' }
  return { Icon: IconFile, color: 'gray' }
}
