import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import type { DelverWebhookEvent } from '../lib/cards'
import { CardError } from '../lib/cards'
import { appendScannedCardsToActiveBox } from '../lib/server/card-repository'
import { getBoxSettings, setSetting } from '../lib/server/store'

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
        const settings = getBoxSettings()
        return withCors(
          json({
            ok: true,
            activeScanningBoxId: settings.activeScanningBoxId,
            lastWebhookEventAt: settings.lastWebhookEventAt,
            lastWebhookEventType: settings.lastWebhookEventType,
          }),
        )
      },
      POST: async ({ request }) => {
        const payload = (await request.json()) as DelverWebhookEvent
        const now = new Date().toISOString()
        setSetting('lastWebhookEventAt', now)
        setSetting('lastWebhookEventType', payload?.type ?? 'unknown')

        if (payload?.type === 'card_scanned') {
          try {
            const result = await appendScannedCardsToActiveBox(payload.cards ?? [])
            return withCors(
              json({
                ok: true,
                type: payload.type,
                boxId: result.box.id,
                boxCode: result.box.code,
                ingested: result.createdCards.length,
              }),
            )
          } catch (error) {
            if (error instanceof CardError) {
              return withCors(
                json({ ok: false, error: error.code, message: error.message }, { status: 409 }),
              )
            }
            throw error
          }
        }

        return withCors(
          json({
            ok: true,
            type: payload?.type ?? 'unknown',
            ingested: 0,
          }),
        )
      },
    },
  },
})
