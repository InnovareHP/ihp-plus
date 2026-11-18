import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'

let client: BedrockRuntimeClient | undefined

// No keys passed: the SDK's own chain reads AWS_* locally and the task role in production.
export function bedrock() {
  client ??= new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  })
  return client
}
