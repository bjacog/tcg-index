import type { DelverWebhookEvent } from '../cards'
import { CardError } from '../cards'
import { appendScannedCardsToActiveBox } from './card-repository'
import { getAppSettings, setAppSetting } from './store'

export async function processDelverEvent(payload: DelverWebhookEvent) {
  const now = new Date().toISOString()
  setAppSetting('lastWebhookEventAt', now)
  setAppSetting('lastWebhookEventType', payload?.type ?? 'unknown')

  if (payload?.type === 'card_scanned') {
    const result = await appendScannedCardsToActiveBox(payload.cards ?? [])

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
  }
}

export async function pollDelverEndpoint() {
  const settings = getAppSettings()

  if (!settings.delverPollingEndpoint) {
    throw new Error('DELVER_POLLING_ENDPOINT_MISSING: Delver polling endpoint is not configured')
  }

  const response = await fetch(settings.delverPollingEndpoint, {
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
    }
  }

  if (!response.ok) {
    throw new Error(`DELVER_POLL_FAILED: Delver poll failed with status ${response.status}`)
  }

  const payload = (await response.json()) as DelverWebhookEvent

  try {
    const result = await processDelverEvent(payload)
    return {
      ...result,
      empty: false,
      status: response.status,
    }
  } catch (error) {
    if (error instanceof CardError) {
      throw new Error(`${error.code}: ${error.message}`)
    }

    throw error instanceof Error ? error : new Error('Unknown Delver polling error')
  }
}
