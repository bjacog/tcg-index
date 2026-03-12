import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getActivePollingBoxes } from '../lib/server/box-repository'
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
        const activeBoxes = await getActivePollingBoxes()

        return withCors(
          json({
            ok: true,
            activePollingBoxes: activeBoxes.map((box) => ({ id: box.id, code: box.code })),
            lastWebhookEventAt: settings.lastWebhookEventAt,
            lastWebhookEventType: settings.lastWebhookEventType,
            delverPollingEndpoint: settings.delverPollingEndpoint,
            delverPollingEnabled: settings.delverPollingEnabled,
            message:
              'Webhook POST handling is not used in the Electron packaging path; Electron polls configured Delver endpoints directly.',
          }),
        )
      },
      POST: async () => {
        return withCors(
          json(
            {
              ok: false,
              message:
                'Direct webhook ingestion is currently disabled. Use configured Delver polling endpoints instead.',
            },
            { status: 501 },
          ),
        )
      },
    },
  },
})
