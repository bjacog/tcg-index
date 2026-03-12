import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  CardError,
  normalizeCardName,
  type CardRecord,
  type CardSearchResult,
  type DelverScannedCard,
} from '../cards'
import type { BoxRecord } from '../boxes'
import type {
  PickCardsInput,
  PickExecutionResult,
  ReturnCardsInput,
  ReturnCardsResult,
} from '../pick-lists'
import { getBoxById } from './box-repository'
import { getPickListById } from './pick-list-repository'
import { getAppSettings, getDb, runInTransaction, setAppSetting } from './store'

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
     WHERE boxes.kind != 'project'
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
  const settings = getAppSettings()
  const activeBoxId = settings.activeScanningBoxId

  if (!activeBoxId) {
    throw new CardError('NO_ACTIVE_SCANNING_BOX', 'No active scanning box is set')
  }

  const box = await getBoxById(activeBoxId)
  if (!box) {
    throw new CardError('BOX_NOT_FOUND', 'Active scanning box no longer exists')
  }

  if (box.kind === 'project') {
    throw new CardError('PROJECT_BOX_SCAN_FORBIDDEN', 'Cannot scan directly into a project box')
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

    setAppSetting('lastWebhookEventAt', now)
    setAppSetting('lastWebhookEventType', 'card_scanned')

    return nextCards
  })

  return {
    box,
    createdCards,
  }
}

export async function pickCardsIntoProject(input: PickCardsInput): Promise<PickExecutionResult> {
  const pickList = await getPickListById(input.pickListId)
  if (!pickList) {
    throw new CardError('PICK_LIST_NOT_FOUND', 'Pick list not found')
  }

  if (pickList.pickedAt) {
    throw new CardError('PICK_LIST_ALREADY_PICKED', 'This pick list has already been picked')
  }

  if (input.cardIds.length === 0) {
    throw new CardError('VALIDATION_ERROR', 'Select at least one card to pick')
  }

  const selectableCardIds = new Set(
    pickList.resultSnapshot.flatMap((boxGroup) => boxGroup.cards.map((card) => card.cardId).filter(Boolean)),
  )

  for (const cardId of input.cardIds) {
    if (!selectableCardIds.has(cardId)) {
      throw new CardError('CARD_NOT_IN_PICK_LIST', 'One or more selected cards are no longer in this pick list')
    }
  }

  return runInTransaction((db) => {
    const currentPickListRow = db
      .prepare('SELECT picked_at FROM pick_lists WHERE id = ?')
      .get(input.pickListId) as { picked_at: string | null } | undefined

    if (!currentPickListRow) {
      throw new CardError('PICK_LIST_NOT_FOUND', 'Pick list not found')
    }

    if (currentPickListRow.picked_at) {
      throw new CardError('PICK_LIST_ALREADY_PICKED', 'This pick list has already been picked')
    }

    const selectedCards = loadCardsByIds(db, input.cardIds)
    if (selectedCards.length !== input.cardIds.length) {
      throw new CardError('CARD_NOT_FOUND', 'One or more selected cards no longer exist')
    }

    const orderedCards = input.cardIds
      .map((cardId) => selectedCards.find((card) => card.id === cardId))
      .filter((card): card is CardRecord => Boolean(card))

    const sourceBoxes = new Map<string, BoxRecord>()
    for (const card of orderedCards) {
      const sourceBox = loadBoxById(db, card.boxId)
      if (!sourceBox) {
        throw new CardError('BOX_NOT_FOUND', 'A source box no longer exists')
      }
      if (sourceBox.kind === 'project') {
        throw new CardError('INVALID_SOURCE_BOX', 'Project cards cannot be picked from a saved pick list')
      }
      sourceBoxes.set(sourceBox.id, sourceBox)
    }

    const projectBox = createNextProjectBox(db)
    const timestamp = new Date().toISOString()
    const updateCardBox = db.prepare('UPDATE cards SET box_id = ?, position = ?, updated_at = ? WHERE id = ?')

    orderedCards.forEach((card, index) => {
      updateCardBox.run(projectBox.id, index + 1, timestamp, card.id)
    })

    for (const sourceBoxId of sourceBoxes.keys()) {
      reindexBoxPositions(db, sourceBoxId)
    }

    db.prepare('UPDATE pick_lists SET picked_at = ?, project_box_id = ? WHERE id = ?').run(
      timestamp,
      projectBox.id,
      input.pickListId,
    )

    return {
      projectBoxId: projectBox.id,
      projectBoxCode: projectBox.code,
      projectBoxName: projectBox.name,
      movedCardCount: orderedCards.length,
    }
  })
}

export async function returnCardsFromProject(input: ReturnCardsInput): Promise<ReturnCardsResult> {
  if (input.cardIds.length === 0) {
    throw new CardError('VALIDATION_ERROR', 'Select at least one card to return')
  }

  return runInTransaction((db) => {
    const sourceBox = loadBoxById(db, input.sourceBoxId)
    if (!sourceBox) {
      throw new CardError('BOX_NOT_FOUND', 'Project box not found')
    }
    if (sourceBox.kind !== 'project') {
      throw new CardError('INVALID_SOURCE_BOX', 'Cards can only be returned from a project box')
    }

    const destinationBox = loadBoxById(db, input.destinationBoxId)
    if (!destinationBox) {
      throw new CardError('BOX_NOT_FOUND', 'Destination box not found')
    }
    if (destinationBox.kind === 'project') {
      throw new CardError('INVALID_DESTINATION_BOX', 'Return destination must be a normal storage box')
    }

    const selectedCards = loadCardsByIds(db, input.cardIds)
    if (selectedCards.length !== input.cardIds.length) {
      throw new CardError('CARD_NOT_FOUND', 'One or more selected cards no longer exist')
    }

    const orderedCards = input.cardIds
      .map((cardId) => selectedCards.find((card) => card.id === cardId))
      .filter((card): card is CardRecord => Boolean(card))

    for (const card of orderedCards) {
      if (card.boxId !== sourceBox.id) {
        throw new CardError('CARD_NOT_IN_PROJECT', 'One or more selected cards are no longer in this project box')
      }
    }

    const maxRow = db
      .prepare('SELECT COALESCE(MAX(position), 0) as max_position FROM cards WHERE box_id = ?')
      .get(destinationBox.id) as { max_position: number }

    let nextPosition = Number(maxRow.max_position) + 1
    const timestamp = new Date().toISOString()
    const updateCardBox = db.prepare('UPDATE cards SET box_id = ?, position = ?, updated_at = ? WHERE id = ?')

    orderedCards.forEach((card) => {
      updateCardBox.run(destinationBox.id, nextPosition++, timestamp, card.id)
    })

    reindexBoxPositions(db, sourceBox.id)

    const remainingInSource = db
      .prepare('SELECT COUNT(*) as count FROM cards WHERE box_id = ?')
      .get(sourceBox.id) as { count: number }

    const sourceBoxDeleted = Number(remainingInSource.count) === 0

    if (sourceBoxDeleted) {
      db.prepare('DELETE FROM boxes WHERE id = ?').run(sourceBox.id)
    }

    return {
      sourceBoxId: sourceBox.id,
      sourceBoxDeleted,
      destinationBoxId: destinationBox.id,
      destinationBoxCode: destinationBox.code,
      movedCardCount: orderedCards.length,
    }
  })
}

function createNextProjectBox(db: DatabaseSync): BoxRecord {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(project_number), 0) as max_project_number
       FROM boxes
       WHERE kind = 'project'`,
    )
    .get() as { max_project_number: number }

  const projectNumber = Number(row.max_project_number) + 1
  const timestamp = new Date().toISOString()
  const box: BoxRecord = {
    id: randomUUID(),
    code: `PROJECT-${String(projectNumber).padStart(3, '0')}`,
    name: `Project ${projectNumber}`,
    description: '',
    locationNote: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    kind: 'project',
    projectNumber,
  }

  db.prepare(
    `INSERT INTO boxes (id, code, name, description, location_note, kind, project_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    box.id,
    box.code,
    box.name,
    box.description,
    box.locationNote,
    box.kind,
    box.projectNumber,
    box.createdAt,
    box.updatedAt,
  )

  return box
}

function loadCardsByIds(db: DatabaseSync, cardIds: string[]) {
  const selectCard = db.prepare('SELECT * FROM cards WHERE id = ?')
  return cardIds
    .map((cardId) => selectCard.get(cardId) as Record<string, unknown> | undefined)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map(mapCardRow)
}

function loadBoxById(db: DatabaseSync, boxId: string) {
  const row = db.prepare('SELECT * FROM boxes WHERE id = ?').get(boxId) as
    | Record<string, unknown>
    | undefined

  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ''),
    locationNote: String(row.location_note ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    kind: String(row.kind ?? 'storage') === 'project' ? 'project' : 'storage',
    projectNumber: row.project_number === null ? null : Number(row.project_number ?? null),
  } satisfies BoxRecord
}

function reindexBoxPositions(db: DatabaseSync, boxId: string) {
  const remainingRows = db
    .prepare('SELECT id FROM cards WHERE box_id = ? ORDER BY position ASC, created_at ASC, id ASC')
    .all(boxId) as Array<{ id: string }>

  const tempOffset = 1000000
  const setTempPosition = db.prepare('UPDATE cards SET position = ? WHERE id = ?')
  const setFinalPosition = db.prepare('UPDATE cards SET position = ? WHERE id = ?')

  remainingRows.forEach((row, index) => {
    setTempPosition.run(tempOffset + index + 1, row.id)
  })

  remainingRows.forEach((row, index) => {
    setFinalPosition.run(index + 1, row.id)
  })
}
