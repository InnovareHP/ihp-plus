import { browserTransport, createClient } from '@ihp/rpc'
import { MembersService } from '@ihp/rpc/members'

// Only the generated contract and the transport, so none of the server graph follows it
// into the client bundle.
export const browserClients = {
  members: createClient(MembersService, browserTransport),
}
