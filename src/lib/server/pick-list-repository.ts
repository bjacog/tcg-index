import { randomUUID } from 'node:crypto'
import type { DashboardStats, PickListHistoryRecord } from '../pick-lists'
import { getDb } from './store'

export async function listPickLists(): Promise<PickListHistoryRecord[]> {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM pick_lists ORDER BY created_at DESC').all() as Array<
    Record<string, unknown>
  >

  return rows.map(mapPickListRow)
}

export async function getPickListById(id: string): Promise<PickListHistoryRecord | null> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM pick_lists WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined

  return row ? mapPickListRow(row) : null
}

export async function createPickListHistory(input: {
  requestedCards: string[]
  missingCards: string[]
  resultSnapshot: PickListHistoryRecord['resultSnapshot']
}): Promise<PickListHistoryRecord> {
  const db = getDb()
  const record: PickListHistoryRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    requestedCards: input.requestedCards,
    missingCards: input.missingCards,
    resultSnapshot: input.resultSnapshot,
    pickedAt: null,
    projectBoxId: null,
  }

  db.prepare(
    `INSERT INTO pick_lists (
      id,
      created_at,
      requested_cards_json,
      missing_cards_json,
      result_snapshot_json,
      picked_at,
      project_box_id
    )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.createdAt,
    JSON.stringify(record.requestedCards),
    JSON.stringify(record.missingCards),
    JSON.stringify(record.resultSnapshot),
    record.pickedAt,
    record.projectBoxId,
  )

  return record
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb()
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM boxes) as box_count,
        (SELECT COUNT(*) FROM cards) as indexed_card_count,
        (SELECT COUNT(DISTINCT lower(name)) FROM cards) as unique_card_name_count,
        (SELECT COUNT(*) FROM pick_lists) as pick_list_count`,
    )
    .get() as {
    box_count: number
    indexed_card_count: number
    unique_card_name_count: number
    pick_list_count: number
  }

  return {
    boxCount: Number(counts.box_count),
    indexedCardCount: Number(counts.indexed_card_count),
    uniqueCardNameCount: Number(counts.unique_card_name_count),
    pickListCount: Number(counts.pick_list_count),
  }
}

function mapPickListRow(row: Record<string, unknown>): PickListHistoryRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    requestedCards: JSON.parse(String(row.requested_cards_json ?? '[]')),
    missingCards: JSON.parse(String(row.missing_cards_json ?? '[]')),
    resultSnapshot: JSON.parse(String(row.result_snapshot_json ?? '[]')),
    pickedAt: row.picked_at === null || row.picked_at === undefined ? null : String(row.picked_at),
    projectBoxId:
      row.project_box_id === null || row.project_box_id === undefined
        ? null
        : String(row.project_box_id),
  }
}
