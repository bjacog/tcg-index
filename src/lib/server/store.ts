import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { BoxSettings } from '../boxes'
import type { CardRecord } from '../cards'

const dataDirectory = path.resolve(process.cwd(), 'data')
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
    createdAt: string
    updatedAt: string
  }>
  cards?: CardRecord[]
  settings?: Partial<BoxSettings>
}

type AppSettingKey =
  | 'activeScanningBoxId'
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
  `)

  seedDefaultSettings(database)
  migrateLegacyJsonStore(database)

  return database
}

function seedDefaultSettings(db: DatabaseSync) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  insertSetting.run('activeScanningBoxId', null)
  insertSetting.run('lastWebhookEventAt', null)
  insertSetting.run('lastWebhookEventType', null)
  insertSetting.run('delverPollingEndpoint', null)
  insertSetting.run('delverPollingEnabled', 'false')
}

function migrateLegacyJsonStore(db: DatabaseSync) {
  const hasBoxes = Number(db.prepare('SELECT COUNT(*) as count FROM boxes').get().count) > 0
  const hasCards = Number(db.prepare('SELECT COUNT(*) as count FROM cards').get().count) > 0

  if (hasBoxes || hasCards || !existsSync(legacyJsonFilePath)) {
    return
  }

  const raw = readFileSync(legacyJsonFilePath, 'utf8')
  const parsed = JSON.parse(raw) as LegacyStore

  const insertBox = db.prepare(`
    INSERT INTO boxes (id, code, name, description, location_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertCard = db.prepare(`
    INSERT INTO cards (
      id, box_id, position, name, edition, number, finish, condition, language,
      quantity, delver_card_id, delver_data_card_id, delver_edition_id,
      scryfall_id, uuid, scanned_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const setSetting = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')

  runSqlTransaction(db, () => {
    for (const box of parsed.boxes ?? []) {
      insertBox.run(
        box.id,
        box.code,
        box.name,
        box.description ?? '',
        box.locationNote ?? '',
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

    setSetting.run('activeScanningBoxId', parsed.settings?.activeScanningBoxId ?? null)
    setSetting.run('lastWebhookEventAt', parsed.settings?.lastWebhookEventAt ?? null)
    setSetting.run('lastWebhookEventType', parsed.settings?.lastWebhookEventType ?? null)
    setSetting.run('delverPollingEndpoint', parsed.settings?.delverPollingEndpoint ?? null)
    setSetting.run('delverPollingEnabled', parsed.settings?.delverPollingEnabled ? 'true' : 'false')
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
    activeScanningBoxId: getRawSetting('activeScanningBoxId'),
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

export { databaseFilePath }
