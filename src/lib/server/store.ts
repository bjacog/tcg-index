import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import type { BoxSettings } from '../boxes'
import type { CardRecord } from '../cards'
import type { PickListHistoryRecord } from '../pick-lists'

function resolveDataDirectory() {
  const configuredDirectory = process.env.TCG_INDEX_DATA_DIR?.trim()

  if (configuredDirectory) {
    return path.resolve(configuredDirectory)
  }

  return path.resolve(process.cwd(), 'data')
}

const dataDirectory = resolveDataDirectory()
const databaseFilePath = path.join(dataDirectory, 'tcg-index.sqlite')
const legacyJsonFilePath = path.join(dataDirectory, 'boxes.json')

let database: DatabaseSync | null = null

type LegacyStore = {
  boxes?: Array<{
    id: string
    code: string
    name: string
    description: string
    locationNote: string
    delverPollingEndpoint?: string | null
    delverPollingActive?: boolean
    createdAt: string
    updatedAt: string
    kind?: 'storage' | 'project'
    projectNumber?: number | null
  }>
  cards?: CardRecord[]
  settings?: Partial<BoxSettings> & { activeScanningBoxId?: string | null }
  pickLists?: PickListHistoryRecord[]
}

type AppSettingKey =
  | 'lastWebhookEventAt'
  | 'lastWebhookEventType'
  | 'delverPollingEndpoint'
  | 'delverPollingEnabled'

function getDatabase() {
  if (database) {
    return database
  }

  mkdirSync(dataDirectory, { recursive: true })
  database = new DatabaseSync(databaseFilePath)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA journal_mode = WAL')

  database.exec(`
    CREATE TABLE IF NOT EXISTS boxes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location_note TEXT NOT NULL DEFAULT '',
      delver_polling_endpoint TEXT,
      delver_polling_active INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'storage',
      project_number INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      box_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      edition TEXT NOT NULL DEFAULT '',
      number TEXT NOT NULL DEFAULT '',
      finish TEXT NOT NULL DEFAULT 'regular',
      condition TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      delver_card_id INTEGER,
      delver_data_card_id INTEGER,
      delver_edition_id INTEGER,
      scryfall_id TEXT NOT NULL DEFAULT '',
      uuid TEXT NOT NULL DEFAULT '',
      scanned_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE,
      UNIQUE (box_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_cards_box_position ON cards(box_id, position);
    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS pick_lists (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      requested_cards_json TEXT NOT NULL,
      missing_cards_json TEXT NOT NULL,
      result_snapshot_json TEXT NOT NULL,
      picked_at TEXT,
      project_box_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pick_lists_created_at ON pick_lists(created_at DESC);
  `)

  migrateDatabase(database)
  seedDefaultSettings(database)
  migrateLegacyJsonStore(database)

  return database
}

function migrateDatabase(db: DatabaseSync) {
  const boxColumns = db.prepare('PRAGMA table_info(boxes)').all() as Array<{ name: string }>
  const boxColumnNames = new Set(boxColumns.map((column) => String(column.name)))

  if (!boxColumnNames.has('kind')) {
    db.exec(`ALTER TABLE boxes ADD COLUMN kind TEXT NOT NULL DEFAULT 'storage'`)
  }

  if (!boxColumnNames.has('project_number')) {
    db.exec('ALTER TABLE boxes ADD COLUMN project_number INTEGER')
  }

  if (!boxColumnNames.has('delver_polling_endpoint')) {
    db.exec('ALTER TABLE boxes ADD COLUMN delver_polling_endpoint TEXT')
  }

  if (!boxColumnNames.has('delver_polling_active')) {
    db.exec('ALTER TABLE boxes ADD COLUMN delver_polling_active INTEGER NOT NULL DEFAULT 0')
  }

  db.exec(`
    UPDATE boxes
    SET kind = 'project'
    WHERE kind IS NULL OR trim(kind) = ''
      AND code GLOB 'PROJECT-[0-9]*'
      AND name GLOB 'Project [0-9]*'
  `)

  const pickListColumns = db.prepare('PRAGMA table_info(pick_lists)').all() as Array<{ name: string }>
  const pickListColumnNames = new Set(pickListColumns.map((column) => String(column.name)))

  if (!pickListColumnNames.has('picked_at')) {
    db.exec('ALTER TABLE pick_lists ADD COLUMN picked_at TEXT')
  }

  if (!pickListColumnNames.has('project_box_id')) {
    db.exec('ALTER TABLE pick_lists ADD COLUMN project_box_id TEXT')
  }

  const hasActiveScanningSetting = db
    .prepare("SELECT 1 FROM app_settings WHERE key = 'activeScanningBoxId'")
    .get() as { 1: number } | undefined

  if (hasActiveScanningSetting) {
    const activeRow = db
      .prepare("SELECT value FROM app_settings WHERE key = 'activeScanningBoxId'")
      .get() as { value: string | null } | undefined
    const defaultEndpointRow = db
      .prepare("SELECT value FROM app_settings WHERE key = 'delverPollingEndpoint'")
      .get() as { value: string | null } | undefined

    if (activeRow?.value && defaultEndpointRow?.value) {
      db.prepare(
        `UPDATE boxes
         SET delver_polling_endpoint = COALESCE(delver_polling_endpoint, ?),
             delver_polling_active = CASE WHEN kind != 'project' THEN 1 ELSE delver_polling_active END
         WHERE id = ? AND kind != 'project'`,
      ).run(defaultEndpointRow.value, activeRow.value)
    }

    db.prepare("DELETE FROM app_settings WHERE key = 'activeScanningBoxId'").run()
  }
}

function seedDefaultSettings(db: DatabaseSync) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  insertSetting.run('lastWebhookEventAt', null)
  insertSetting.run('lastWebhookEventType', null)
  insertSetting.run('delverPollingEndpoint', null)
  insertSetting.run('delverPollingEnabled', 'false')
}

function migrateLegacyJsonStore(db: DatabaseSync) {
  const hasBoxes = Number(db.prepare('SELECT COUNT(*) as count FROM boxes').get().count) > 0
  const hasCards = Number(db.prepare('SELECT COUNT(*) as count FROM cards').get().count) > 0
  const hasPickLists =
    Number(db.prepare('SELECT COUNT(*) as count FROM pick_lists').get().count) > 0

  if (hasBoxes || hasCards || hasPickLists || !existsSync(legacyJsonFilePath)) {
    return
  }

  const raw = readFileSync(legacyJsonFilePath, 'utf8')
  const parsed = JSON.parse(raw) as LegacyStore

  const defaultEndpoint = parsed.settings?.delverPollingEndpoint ?? null
  const activeScanningBoxId = parsed.settings?.activeScanningBoxId ?? null

  const insertBox = db.prepare(`
    INSERT INTO boxes (
      id, code, name, description, location_note, delver_polling_endpoint, delver_polling_active, kind, project_number, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertCard = db.prepare(`
    INSERT INTO cards (
      id, box_id, position, name, edition, number, finish, condition, language,
      quantity, delver_card_id, delver_data_card_id, delver_edition_id,
      scryfall_id, uuid, scanned_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const setSetting = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
  const insertPickList = db.prepare(`
    INSERT INTO pick_lists (
      id,
      created_at,
      requested_cards_json,
      missing_cards_json,
      result_snapshot_json,
      picked_at,
      project_box_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  runSqlTransaction(db, () => {
    for (const box of parsed.boxes ?? []) {
      const endpoint =
        box.delverPollingEndpoint ??
        (activeScanningBoxId && activeScanningBoxId === box.id ? defaultEndpoint : null) ??
        null
      const isActive =
        box.delverPollingActive ?? Boolean(activeScanningBoxId && activeScanningBoxId === box.id && endpoint)

      insertBox.run(
        box.id,
        box.code,
        box.name,
        box.description ?? '',
        box.locationNote ?? '',
        endpoint,
        isActive ? 1 : 0,
        box.kind ?? 'storage',
        box.projectNumber ?? null,
        box.createdAt,
        box.updatedAt,
      )
    }

    for (const card of parsed.cards ?? []) {
      insertCard.run(
        card.id,
        card.boxId,
        card.position,
        card.name,
        card.edition ?? '',
        card.number ?? '',
        card.finish ?? 'regular',
        card.condition ?? '',
        card.language ?? '',
        card.quantity ?? 1,
        card.delverCardId,
        card.delverDataCardId,
        card.delverEditionId,
        card.scryfallId ?? '',
        card.uuid ?? '',
        card.scannedAt,
        card.createdAt,
        card.updatedAt,
      )
    }

    setSetting.run('lastWebhookEventAt', parsed.settings?.lastWebhookEventAt ?? null)
    setSetting.run('lastWebhookEventType', parsed.settings?.lastWebhookEventType ?? null)
    setSetting.run('delverPollingEndpoint', parsed.settings?.delverPollingEndpoint ?? null)
    setSetting.run('delverPollingEnabled', parsed.settings?.delverPollingEnabled ? 'true' : 'false')

    for (const pickList of parsed.pickLists ?? []) {
      insertPickList.run(
        pickList.id,
        pickList.createdAt,
        JSON.stringify(pickList.requestedCards ?? []),
        JSON.stringify(pickList.missingCards ?? []),
        JSON.stringify(pickList.resultSnapshot ?? []),
        pickList.pickedAt ?? null,
        pickList.projectBoxId ?? null,
      )
    }
  })
}

function runSqlTransaction<T>(db: DatabaseSync, callback: () => T) {
  db.exec('BEGIN')

  try {
    const result = callback()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function getRawSetting(key: AppSettingKey) {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string | null }
    | undefined

  return row?.value ?? null
}

export function setAppSetting(key: AppSettingKey, value: string | null) {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getAppSettings(): BoxSettings {
  return {
    lastWebhookEventAt: getRawSetting('lastWebhookEventAt'),
    lastWebhookEventType: getRawSetting('lastWebhookEventType'),
    delverPollingEndpoint: getRawSetting('delverPollingEndpoint'),
    delverPollingEnabled: getRawSetting('delverPollingEnabled') === 'true',
  }
}

export function runInTransaction<T>(callback: (db: DatabaseSync) => T) {
  const db = getDatabase()
  return runSqlTransaction(db, () => callback(db))
}

export function getDb() {
  return getDatabase()
}

export { dataDirectory, databaseFilePath }
