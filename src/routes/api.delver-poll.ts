import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { pollDelverEndpoint } from '../lib/server/delver'

function withCors(response: Response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

export const Route = createFileRoute('/api/delver-poll')({
  server: {
    handlers: {
      OPTIONS: async () => withCors(json({ message: 'CORS preflight' })),
      POST: async () => {
        try {
          return withCors(json(await pollDelverEndpoint()))
        } catch (error) {
          return withCors(
            json(
              {
                ok: false,
                message: error instanceof Error ? error.message : 'Failed to poll Delver',
              },
              { status: 500 },
            ),
          )
        }
      },
    },
  },
})
