import { randomUUID } from 'node:crypto'
import {
  BoxError,
  type BoxRecord,
  type BoxSettings,
  type CreateBoxInput,
  type SetActiveScanningBoxInput,
  type SetPollingEnabledInput,
  type UpdateBoxInput,
  type UpdatePollingSettingsInput,
  normalizeBoxInput,
} from '../boxes'
import { getAppSettings, getDb, runInTransaction, setAppSetting } from './store'

function mapBoxRow(row: Record<string, unknown>): BoxRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ''),
    locationNote: String(row.location_note ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listBoxes() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM boxes ORDER BY code ASC').all() as Array<
    Record<string, unknown>
  >

  return rows.map(mapBoxRow)
}

export async function getBoxById(id: string) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM boxes WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined

  return row ? mapBoxRow(row) : null
}

export async function getBoxSettings(): Promise<BoxSettings> {
  return getAppSettings()
}

export async function updatePollingSettings(input: UpdatePollingSettingsInput) {
  const endpoint = input.delverPollingEndpoint.trim()

  setAppSetting('delverPollingEndpoint', endpoint || null)
  return getAppSettings()
}

export async function setPollingEnabled(input: SetPollingEnabledInput) {
  const settings = getAppSettings()

  if (input.enabled && !settings.delverPollingEndpoint) {
    throw new BoxError('POLLING_ENDPOINT_MISSING', 'Set the Delver polling endpoint first')
  }

  if (input.enabled && !settings.activeScanningBoxId) {
    throw new BoxError('NO_ACTIVE_SCANNING_BOX', 'Set an active scanning box before polling')
  }

  setAppSetting('delverPollingEnabled', input.enabled ? 'true' : 'false')
  return getAppSettings()
}

export async function createBox(input: CreateBoxInput) {
  const db = getDb()
  const normalized = normalizeBoxInput(input)

  const duplicate = db
    .prepare('SELECT id FROM boxes WHERE lower(code) = lower(?)')
    .get(normalized.code) as { id: string } | undefined

  if (duplicate) {
    throw new BoxError('BOX_CODE_CONFLICT', `Box code ${normalized.code} already exists`)
  }

  const timestamp = new Date().toISOString()
  const box: BoxRecord = {
    id: randomUUID(),
    code: normalized.code,
    name: normalized.name,
    description: normalized.description,
    locationNote: normalized.locationNote,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  db.prepare(
    `INSERT INTO boxes (id, code, name, description, location_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(box.id, box.code, box.name, box.description, box.locationNote, box.createdAt, box.updatedAt)

  return box
}

export async function updateBox(input: UpdateBoxInput) {
  const db = getDb()
  const current = db.prepare('SELECT * FROM boxes WHERE id = ?').get(input.id) as
    | Record<string, unknown>
    | undefined

  if (!current) {
    throw new BoxError('BOX_NOT_FOUND', 'Box not found')
  }

  const nextCode = input.code === undefined ? String(current.code) : input.code.trim()
  const nextName = input.name === undefined ? String(current.name) : input.name.trim()
  const nextDescription =
    input.description === undefined ? String(current.description ?? '') : input.description.trim()
  const nextLocationNote =
    input.locationNote === undefined
      ? String(current.location_note ?? '')
      : input.locationNote.trim()

  if (!nextCode) {
    throw new BoxError('VALIDATION_ERROR', 'Box code is required')
  }

  if (!nextName) {
    throw new BoxError('VALIDATION_ERROR', 'Box name is required')
  }

  const duplicate = db
    .prepare('SELECT id FROM boxes WHERE id != ? AND lower(code) = lower(?)')
    .get(input.id, nextCode) as { id: string } | undefined

  if (duplicate) {
    throw new BoxError('BOX_CODE_CONFLICT', `Box code ${nextCode} already exists`)
  }

  const updatedAt = new Date().toISOString()
  db.prepare(
    `UPDATE boxes
     SET code = ?, name = ?, description = ?, location_note = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextCode, nextName, nextDescription, nextLocationNote, updatedAt, input.id)

  return {
    id: input.id,
    code: nextCode,
    name: nextName,
    description: nextDescription,
    locationNote: nextLocationNote,
    createdAt: String(current.created_at),
    updatedAt,
  }
}

export async function setActiveScanningBox(input: SetActiveScanningBoxInput) {
  if (input.boxId !== null) {
    const box = await getBoxById(input.boxId)
    if (!box) {
      throw new BoxError('BOX_NOT_FOUND', 'Box not found')
    }
  }

  setAppSetting('activeScanningBoxId', input.boxId)
  setAppSetting('delverPollingEnabled', input.boxId ? 'true' : 'false')

  return getAppSettings()
}

export async function stopScanning() {
  setAppSetting('delverPollingEnabled', 'false')
  setAppSetting('activeScanningBoxId', null)
  return getAppSettings()
}

export async function deleteBox(id: string) {
  const box = await getBoxById(id)

  if (!box) {
    throw new BoxError('BOX_NOT_FOUND', 'Box not found')
  }

  runInTransaction((db) => {
    db.prepare('DELETE FROM boxes WHERE id = ?').run(id)

    if (getAppSettings().activeScanningBoxId === id) {
      setAppSetting('activeScanningBoxId', null)
      setAppSetting('delverPollingEnabled', 'false')
    }
  })

  return box
}
