import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const executablePath = vi.hoisted(() => vi.fn())

vi.mock('@sparticuz/chromium', () => ({ default: { executablePath, args: [] } }))
vi.mock('puppeteer-core', () => ({ default: { launch: vi.fn(), defaultArgs: vi.fn() } }))
vi.mock('@ihp/db', () => ({ db: {} }))
vi.mock('@/lib/s3', () => ({ putObject: vi.fn() }))

const { CHROMIUM_PACK_URL, chromiumExecutable } = await import('./snapshot')

describe('chromiumExecutable', () => {
  beforeEach(() => {
    executablePath.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses the bundled browser when its files shipped', async () => {
    executablePath.mockResolvedValueOnce('/tmp/chromium')

    await expect(chromiumExecutable()).resolves.toBe('/tmp/chromium')
    expect(executablePath).toHaveBeenCalledTimes(1)
    expect(executablePath).toHaveBeenCalledWith()
  })

  it('downloads the same build when the bundled files are missing', async () => {
    executablePath
      .mockRejectedValueOnce(new Error('The input directory "/var/task/bin" does not exist.'))
      .mockResolvedValueOnce('/tmp/chromium')

    await expect(chromiumExecutable()).resolves.toBe('/tmp/chromium')
    expect(executablePath).toHaveBeenLastCalledWith(CHROMIUM_PACK_URL)
  })

  it('downloads from the configured mirror when one is set', async () => {
    vi.stubEnv('SNAPSHOT_CHROMIUM_PACK_URL', 'https://mirror.example/pack.tar')
    executablePath.mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce('/tmp/c')

    await chromiumExecutable()
    expect(executablePath).toHaveBeenLastCalledWith('https://mirror.example/pack.tar')
  })

  it('fails when the download fails too', async () => {
    executablePath
      .mockRejectedValueOnce(new Error('missing'))
      .mockRejectedValueOnce(new Error('download failed'))

    await expect(chromiumExecutable()).rejects.toThrow('download failed')
  })
})
