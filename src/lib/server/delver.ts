import type { DelverWebhookEvent } from '../cards'
import { CardError } from '../cards'
import { appendScannedCardsToBox } from './card-repository'
import { getBoxesWithPollingEndpoints } from './box-repository'
import { getAppSettings, setAppSetting } from './store'

export async function processDelverEvent(boxId: string, payload: DelverWebhookEvent) {
  const now = new Date().toISOString()
  setAppSetting('lastWebhookEventAt', now)
  setAppSetting('lastWebhookEventType', payload?.type ?? 'unknown')

  if (payload?.type === 'card_scanned') {
    const result = await appendScannedCardsToBox(boxId, payload.cards ?? [])

    return {
      ok: true,
      type: payload.type,
      boxId: result.box.id,
      boxCode: result.box.code,
      ingested: result.createdCards.length,
    }
  }

  return {
    ok: true,
    type: payload?.type ?? 'unknown',
    ingested: 0,
    boxId,
  }
}

export async function pollDelverEndpoints() {
  const settings = getAppSettings()

  if (!settings.delverPollingEnabled) {
    return {
      ok: true,
      empty: true,
      status: 204,
      boxResults: [],
    }
  }

  const boxes = await getBoxesWithPollingEndpoints()

  if (boxes.length === 0) {
    throw new Error('DELVER_POLLING_ENDPOINT_MISSING: No box polling endpoints are configured')
  }

  const results = await Promise.all(
    boxes.map(async (box) => {
      const response = await fetch(String(box.delverPollingEndpoint), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.status === 404) {
        return {
          ok: true,
          empty: true,
          status: 404,
          boxId: box.id,
          boxCode: box.code,
          endpoint: box.delverPollingEndpoint,
        }
      }

      if (!response.ok) {
        throw new Error(`DELVER_POLL_FAILED: ${box.code} poll failed with status ${response.status}`)
      }

      const payload = (await response.json()) as DelverWebhookEvent
      const processed = await processDelverEvent(box.id, payload)

      return {
        ...processed,
        empty: false,
        status: response.status,
        endpoint: box.delverPollingEndpoint,
      }
    }),
  )

  const nonEmptyResults = results.filter((result) => !result.empty)

  return {
    ok: true,
    empty: nonEmptyResults.length === 0,
    status: nonEmptyResults.length === 0 ? 404 : 200,
    boxResults: results,
    ingested: nonEmptyResults.reduce((sum, result) => sum + (result.ingested ?? 0), 0),
  }
}

export async function pollDelverEndpointsSafely() {
  try {
    return await pollDelverEndpoints()
  } catch (error) {
    if (error instanceof CardError) {
      throw new Error(`${error.code}: ${error.message}`)
    }

    throw error instanceof Error ? error : new Error('Unknown Delver polling error')
  }
}
