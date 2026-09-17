export class GraphNotConfiguredError extends Error {
  constructor() {
    super('Microsoft Graph is not configured — set the GRAPH_* variables in .env.')
    this.name = 'GraphNotConfiguredError'
  }
}

/** A certificate outlives a client secret, which Entra caps at 24 months. */
export interface GraphCertificate {
  privateKeyPem: string
  /** SHA-1 thumbprint as Entra shows it, hex with or without colons. */
  thumbprint: string
}

export interface GraphConfig {
  tenantId: string
  clientId: string
  secret: string | undefined
  certificate: GraphCertificate | undefined
  /** The staff library every internal document lives in. */
  internalDriveId: string | undefined
  /** The library client folders are mirrored into and shared from. */
  clientDriveId: string | undefined
}

function readCertificate(): GraphCertificate | undefined {
  const privateKeyPem = process.env.GRAPH_CLIENT_CERT_PRIVATE_KEY
  const thumbprint = process.env.GRAPH_CLIENT_CERT_THUMBPRINT
  if (!privateKeyPem || !thumbprint) return undefined
  // Env files cannot hold real newlines, so the PEM travels with them escaped.
  return { privateKeyPem: privateKeyPem.replace(/\n/g, '\n'), thumbprint }
}

export function readGraphConfig(): GraphConfig | null {
  const tenantId = process.env.GRAPH_TENANT_ID
  const clientId = process.env.GRAPH_CLIENT_ID
  const secret = process.env.GRAPH_CLIENT_SECRET
  const certificate = readCertificate()
  // `common` works for a login app but a daemon token is issued by one tenant only.
  if (!tenantId || tenantId === 'common' || !clientId) return null
  if (!secret && !certificate) return null

  return {
    tenantId,
    clientId,
    secret,
    certificate,
    internalDriveId: process.env.GRAPH_INTERNAL_DRIVE_ID,
    clientDriveId: process.env.GRAPH_CLIENT_DRIVE_ID,
  }
}

export function requireGraphConfig(): GraphConfig {
  const config = readGraphConfig()
  if (!config) throw new GraphNotConfiguredError()
  return config
}

export function isGraphConfigured() {
  return readGraphConfig() !== null
}

export function requireInternalDriveId() {
  const { internalDriveId } = requireGraphConfig()
  if (!internalDriveId) throw new GraphNotConfiguredError()
  return internalDriveId
}

export function requireClientDriveId() {
  const { clientDriveId } = requireGraphConfig()
  if (!clientDriveId) throw new GraphNotConfiguredError()
  return clientDriveId
}
