import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import type { DelverWebhookEvent } from '../lib/cards'
import { CardError } from '../lib/cards'
import { appendScannedCardsToActiveBox } from '../lib/server/card-repository'
import { ensureStore, saveStore } from '../lib/server/store'

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
        const store = await ensureStore()
        return withCors(
          json({
            ok: true,
            activeScanningBoxId: store.settings.activeScanningBoxId,
            lastWebhookEventAt: store.settings.lastWebhookEventAt,
            lastWebhookEventType: store.settings.lastWebhookEventType,
          }),
        )
      },
      POST: async ({ request }) => {
        const payload = (await request.json()) as DelverWebhookEvent
        const store = await ensureStore()
        const now = new Date().toISOString()
        store.settings.lastWebhookEventAt = now
        store.settings.lastWebhookEventType = payload?.type ?? 'unknown'
        await saveStore(store)

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
