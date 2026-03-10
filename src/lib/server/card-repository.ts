import { randomUUID } from 'node:crypto'
import {
  CardError,
  normalizeCardName,
  type CardRecord,
  type CardSearchResult,
  type DelverScannedCard,
} from '../cards'
import { ensureStore, saveStore } from './store'

export async function listCardsForBox(boxId: string) {
  const store = await ensureStore()
  return store.cards
    .filter((card) => card.boxId === boxId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

export async function searchCardsByExactNames(names: string[]): Promise<CardSearchResult[]> {
  const store = await ensureStore()
  const requested = new Set(names.map(normalizeCardName).filter(Boolean))

  return store.cards
    .filter((card) => requested.has(normalizeCardName(card.name)))
    .map((card) => {
      const box = store.boxes.find((entry) => entry.id === card.boxId)
      return {
        ...card,
        boxCode: box?.code ?? 'UNKNOWN',
        boxName: box?.name ?? 'Unknown box',
      }
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.boxCode.localeCompare(b.boxCode) ||
        a.position - b.position,
    )
}

export async function appendScannedCardsToActiveBox(scannedCards: DelverScannedCard[]) {
  const store = await ensureStore()
  const activeBoxId = store.settings.activeScanningBoxId

  if (!activeBoxId) {
    throw new CardError('NO_ACTIVE_SCANNING_BOX', 'No active scanning box is set')
  }

  const box = store.boxes.find((entry) => entry.id === activeBoxId)
  if (!box) {
    throw new CardError('BOX_NOT_FOUND', 'Active scanning box no longer exists')
  }

  const boxCards = store.cards.filter((card) => card.boxId === activeBoxId)
  let nextPosition = boxCards.reduce((max, card) => Math.max(max, card.position), 0) + 1
  const now = new Date().toISOString()

  const createdCards = scannedCards.map((scannedCard) => {
    const card: CardRecord = {
      id: randomUUID(),
      boxId: activeBoxId,
      position: nextPosition++,
      name: scannedCard.name?.trim() || 'Unknown card',
      edition: scannedCard.edition?.trim() || '',
      number: scannedCard.number?.trim() || '',
      finish: scannedCard.finish?.trim() || 'regular',
      condition: scannedCard.condition?.trim() || '',
      language: scannedCard.language?.trim() || '',
      quantity: scannedCard.quantity ?? 1,
      delverCardId: scannedCard.cardId ?? null,
      delverDataCardId: scannedCard.dataCardId ?? null,
      delverEditionId: scannedCard.editionId ?? null,
      scryfallId: scannedCard.scryfallId?.trim() || '',
      uuid: scannedCard.uuid?.trim() || '',
      scannedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    store.cards.push(card)
    return card
  })

  store.settings.lastWebhookEventAt = now
  store.settings.lastWebhookEventType = 'card_scanned'
  await saveStore(store)

  return {
    box,
    createdCards,
  }
}
