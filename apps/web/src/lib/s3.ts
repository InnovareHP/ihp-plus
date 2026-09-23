import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// A presigned link outlives one render but not a shared screenshot.
const READ_URL_TTL_SECONDS = 15 * 60

export class S3NotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured — set the S3_* variables in .env.')
    this.name = 'S3NotConfiguredError'
  }
}

interface S3Config {
  bucket: string
  region: string
  endpoint: string | undefined
  publicEndpoint: string | undefined
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

function readConfig(): S3Config | null {
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null

  return {
    bucket,
    region: process.env.S3_REGION ?? 'us-east-1',
    // MinIO and every other S3-compatible endpoint need path-style addressing.
    endpoint: process.env.S3_ENDPOINT,
    // SigV4 signs the Host header, so a link the browser opens must be signed for the host
    // the browser uses — inside compose that is not the one this container talks to.
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  }
}

let cached: { config: S3Config; client: S3Client; publicClient: S3Client } | undefined

function makeClient(config: S3Config, endpoint: string | undefined) {
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}

// Built on first use, not at import: a build must not require credentials.
function connect() {
  const config = readConfig()
  if (!config) throw new S3NotConfiguredError()

  cached ??= {
    config,
    client: makeClient(config, config.endpoint),
    publicClient: makeClient(config, config.publicEndpoint),
  }

  return cached
}

export function isObjectStorageConfigured() {
  return readConfig() !== null
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const { client, config } = connect()
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function deleteObject(key: string) {
  const { client, config } = connect()
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}

export async function objectUrl(key: string) {
  const { publicClient, config } = connect()
  return getSignedUrl(publicClient, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
    expiresIn: READ_URL_TTL_SECONDS,
  })
}

export interface StoredObject {
  body: ReadableStream<Uint8Array>
  contentType: string
  contentLength: number | undefined
}

/** The object itself, for a route that serves it on our own domain instead of handing out S3. */
export async function getObject(key: string): Promise<StoredObject | null> {
  const { client, config } = connect()
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
    if (!response.Body) return null
    return {
      body: response.Body.transformToWebStream(),
      contentType: response.ContentType ?? 'application/octet-stream',
      contentLength: response.ContentLength,
    }
  } catch (error) {
    // A key that was deleted under the row is a missing file, not a storage outage.
    if (error instanceof Error && error.name === 'NoSuchKey') return null
    throw error
  }
}
