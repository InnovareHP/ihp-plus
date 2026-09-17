import { describe, expect, it } from 'vitest'
import { fileLook, formatBytes } from './file-look'

describe('fileLook', () => {
  it('gives each family of document its own icon and colour', () => {
    expect(fileLook('application/pdf').color).toBe('red')
    expect(
      fileLook('application/vnd.openxmlformats-officedocument.wordprocessingml.document').color,
    ).toBe('blue')
    expect(fileLook('text/csv').color).toBe('green')
    expect(fileLook('image/png').color).toBe('grape')
  })

  it('falls back to a plain file for anything unrecognised', () => {
    expect(fileLook('application/octet-stream').color).toBe('gray')
  })
})

describe('formatBytes', () => {
  it('reads as a person would say it', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
  })
})
