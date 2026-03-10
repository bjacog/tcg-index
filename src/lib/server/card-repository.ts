import { randomUUID } from 'node:crypto'
import {
  CardError,
  normalizeCardName,
  type CardRecord,
  type CardSearchResult,
  type DelverScannedCard,
} from '../cards'
import { getBoxById } from './box-repository'
import { getBoxSettings, getDb, runInTransaction, setSetting } from './store'

function mapCardRow(row: Record<string, unknown>): CardRecord {
  return {
    id: String(row.id),
    boxId: String(row.box_id),
    position: Number(row.position),
    name: String(row.name),
    edition: String(row.edition ?? ''),
    number: String(row.number ?? ''),
    finish: String(row.finish ?? 'regular'),
    condition: String(row.condition ?? ''),
    language: String(row.language ?? ''),
    quantity: Number(row.quantity ?? 1),
    delverCardId: row.delver_card_id === null ? null : Number(row.delver_card_id),
    delverDataCardId: row.delver_data_card_id === null ? null : Number(row.delver_data_card_id),
    delverEditionId: row.delver_edition_id === null ? null : Number(row.delver_edition_id),
    scryfallId: String(row.scryfall_id ?? ''),
    uuid: String(row.uuid ?? ''),
    scannedAt: String(row.scanned_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listCardsForBox(boxId: string) {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM cards WHERE box_id = ? ORDER BY position ASC, created_at ASC')
    .all(boxId) as Array<Record<string, unknown>>

  return rows.map(mapCardRow)
}

export async function searchCardsByExactNames(names: string[]): Promise<CardSearchResult[]> {
  const requested = new Set(names.map(normalizeCardName).filter(Boolean))

  if (requested.size === 0) {
    return []
  }

  const db = getDb()
  const rows = db
    .prepare(
      `SELECT
      cards.*, boxes.code as box_code, boxes.name as box_name
     FROM cards
     INNER JOIN boxes ON boxes.id = cards.box_id
     ORDER BY cards.name ASC, boxes.code ASC, cards.position ASC`,
    )
    .all() as Array<Record<string, unknown>>

  return rows
    .filter((row) => requested.has(normalizeCardName(String(row.name))))
    .map((row) => ({
      ...mapCardRow(row),
      boxCode: String(row.box_code),
      boxName: String(row.box_name),
    }))
}

export async function appendScannedCardsToActiveBox(scannedCards: DelverScannedCard[]) {
  const settings = getBoxSettings()
  const activeBoxId = settings.activeScanningBoxId

  if (!activeBoxId) {
    throw new CardError('NO_ACTIVE_SCANNING_BOX', 'No active scanning box is set')
  }

  const box = await getBoxById(activeBoxId)
  if (!box) {
    throw new CardError('BOX_NOT_FOUND', 'Active scanning box no longer exists')
  }

  const now = new Date().toISOString()
  const createdCards = runInTransaction((db) => {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(position), 0) as max_position FROM cards WHERE box_id = ?')
      .get(activeBoxId) as { max_position: number }

    let nextPosition = Number(maxRow.max_position) + 1

    const insertCard = db.prepare(`
      INSERT INTO cards (
        id, box_id, position, name, edition, number, finish, condition, language,
        quantity, delver_card_id, delver_data_card_id, delver_edition_id,
        scryfall_id, uuid, scanned_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const nextCards = scannedCards.map((scannedCard) => {
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

      insertCard.run(
        card.id,
        card.boxId,
        card.position,
        card.name,
        card.edition,
        card.number,
        card.finish,
        card.condition,
        card.language,
        card.quantity,
        card.delverCardId,
        card.delverDataCardId,
        card.delverEditionId,
        card.scryfallId,
        card.uuid,
        card.scannedAt,
        card.createdAt,
        card.updatedAt,
      )

      return card
    })

    setSetting('lastWebhookEventAt', now)
    setSetting('lastWebhookEventType', 'card_scanned')

    return nextCards
  })

  return {
    box,
    createdCards,
  }
}
