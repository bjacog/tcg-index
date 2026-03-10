import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { CardError } from '../lib/cards'
import type { DelverWebhookEvent } from '../lib/cards'
import { processDelverEvent } from '../lib/server/delver'
import { getAppSettings } from '../lib/server/store'

function withCors(response: Response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

export const Route = createFileRoute('/api/delver-webhook')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return withCors(json({ message: 'CORS preflight' }))
      },
      GET: async () => {
        const settings = getAppSettings()
        return withCors(
          json({
            ok: true,
            activeScanningBoxId: settings.activeScanningBoxId,
            lastWebhookEventAt: settings.lastWebhookEventAt,
            lastWebhookEventType: settings.lastWebhookEventType,
            delverPollingEndpoint: settings.delverPollingEndpoint,
            delverPollingEnabled: settings.delverPollingEnabled,
          }),
        )
      },
      POST: async ({ request }) => {
        const payload = (await request.json()) as DelverWebhookEvent

        try {
          return withCors(json(await processDelverEvent(payload)))
        } catch (error) {
          if (error instanceof CardError) {
            return withCors(
              json({ ok: false, error: error.code, message: error.message }, { status: 409 }),
            )
          }
          throw error
        }
      },
    },
  },
})
