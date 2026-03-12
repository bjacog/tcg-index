import { randomUUID } from 'node:crypto'
import {
  BoxError,
  type BoxRecord,
  type BoxSettings,
  type CreateBoxInput,
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
    delverPollingEndpoint:
      row.delver_polling_endpoint === null || row.delver_polling_endpoint === undefined
        ? null
        : String(row.delver_polling_endpoint),
    delverPollingActive: Number(row.delver_polling_active ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    kind: String(row.kind ?? 'storage') === 'project' ? 'project' : 'storage',
    projectNumber: row.project_number === null ? null : Number(row.project_number ?? null),
  }
}

function normalizeEndpoint(endpoint: string | null) {
  return endpoint?.trim() || null
}

function assertUniqueActiveEndpoint(
  db: ReturnType<typeof getDb>,
  input: { id: string; endpoint: string | null; active: boolean },
) {
  if (!input.active || !input.endpoint) {
    return
  }

  const duplicate = db
    .prepare(
      `SELECT id, code
       FROM boxes
       WHERE id != ?
         AND kind != 'project'
         AND delver_polling_active = 1
         AND lower(trim(delver_polling_endpoint)) = lower(trim(?))`,
    )
    .get(input.id, input.endpoint) as { id: string; code: string } | undefined

  if (duplicate) {
    throw new BoxError(
      'DELVER_ENDPOINT_ALREADY_ACTIVE',
      `Delver endpoint is already active for ${duplicate.code}`,
    )
  }
}

export async function listBoxes() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM boxes ORDER BY kind ASC, code ASC').all() as Array<
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

export async function getActivePollingBoxes() {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT *
       FROM boxes
       WHERE kind != 'project'
         AND delver_polling_active = 1
         AND delver_polling_endpoint IS NOT NULL
         AND trim(delver_polling_endpoint) != ''
       ORDER BY code ASC`,
    )
    .all() as Array<Record<string, unknown>>

  return rows.map(mapBoxRow)
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
  if (input.enabled) {
    const boxes = await getActivePollingBoxes()
    if (boxes.length === 0) {
      throw new BoxError(
        'POLLING_ENDPOINT_MISSING',
        'Activate polling on at least one storage box first',
      )
    }
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
    delverPollingEndpoint: normalized.delverPollingEndpoint,
    delverPollingActive: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    kind: 'storage',
    projectNumber: null,
  }

  db.prepare(
    `INSERT INTO boxes (
      id, code, name, description, location_note, delver_polling_endpoint, delver_polling_active, kind, project_number, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    box.id,
    box.code,
    box.name,
    box.description,
    box.locationNote,
    box.delverPollingEndpoint,
    box.delverPollingActive ? 1 : 0,
    box.kind,
    box.projectNumber,
    box.createdAt,
    box.updatedAt,
  )

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

  const isProjectBox = String(current.kind ?? 'storage') === 'project'

  if (isProjectBox && input.code !== undefined) {
    const nextCode = input.code.trim()
    if (nextCode !== String(current.code)) {
      throw new BoxError('PROJECT_BOX_LOCKED', 'Project box codes cannot be changed')
    }
  }

  if (isProjectBox && input.locationNote !== undefined) {
    const nextLocationNote = input.locationNote.trim()
    if (nextLocationNote !== String(current.location_note ?? '')) {
      throw new BoxError('PROJECT_BOX_LOCATION_LOCKED', 'Project box location cannot be changed')
    }
  }

  if (isProjectBox && input.delverPollingEndpoint !== undefined) {
    const nextEndpoint = input.delverPollingEndpoint.trim()
    if (nextEndpoint) {
      throw new BoxError('PROJECT_BOX_SCAN_FORBIDDEN', 'Project boxes cannot have a polling endpoint')
    }
  }

  if (isProjectBox && input.delverPollingActive) {
    throw new BoxError('PROJECT_BOX_SCAN_FORBIDDEN', 'Project boxes cannot have active polling')
  }

  const nextCode = input.code === undefined ? String(current.code) : input.code.trim()
  const nextName = input.name === undefined ? String(current.name) : input.name.trim()
  const nextDescription =
    input.description === undefined ? String(current.description ?? '') : input.description.trim()
  const nextLocationNote =
    input.locationNote === undefined
      ? String(current.location_note ?? '')
      : input.locationNote.trim()
  const nextDelverPollingEndpoint =
    input.delverPollingEndpoint === undefined
      ? normalizeEndpoint(String(current.delver_polling_endpoint ?? ''))
      : normalizeEndpoint(input.delverPollingEndpoint)
  const nextDelverPollingActive =
    input.delverPollingActive === undefined
      ? Number(current.delver_polling_active ?? 0) === 1
      : input.delverPollingActive

  if (!nextCode) {
    throw new BoxError('VALIDATION_ERROR', 'Box code is required')
  }

  if (!nextName) {
    throw new BoxError('VALIDATION_ERROR', 'Box name is required')
  }

  if (nextDelverPollingActive && !nextDelverPollingEndpoint) {
    throw new BoxError(
      'POLLING_ENDPOINT_MISSING',
      'Set a Delver polling endpoint before activating polling for this box',
    )
  }

  const duplicate = db
    .prepare('SELECT id FROM boxes WHERE id != ? AND lower(code) = lower(?)')
    .get(input.id, nextCode) as { id: string } | undefined

  if (duplicate) {
    throw new BoxError('BOX_CODE_CONFLICT', `Box code ${nextCode} already exists`)
  }

  assertUniqueActiveEndpoint(db, {
    id: input.id,
    endpoint: nextDelverPollingEndpoint,
    active: nextDelverPollingActive,
  })

  const updatedAt = new Date().toISOString()
  db.prepare(
    `UPDATE boxes
     SET code = ?, name = ?, description = ?, location_note = ?, delver_polling_endpoint = ?, delver_polling_active = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    nextCode,
    nextName,
    nextDescription,
    nextLocationNote,
    nextDelverPollingEndpoint,
    nextDelverPollingActive ? 1 : 0,
    updatedAt,
    input.id,
  )

  return {
    id: input.id,
    code: nextCode,
    name: nextName,
    description: nextDescription,
    locationNote: nextLocationNote,
    delverPollingEndpoint: nextDelverPollingEndpoint,
    delverPollingActive: nextDelverPollingActive,
    createdAt: String(current.created_at),
    updatedAt,
    kind: String(current.kind ?? 'storage') === 'project' ? 'project' : 'storage',
    projectNumber: current.project_number === null ? null : Number(current.project_number ?? null),
  } satisfies BoxRecord
}

export async function stopScanning() {
  setAppSetting('delverPollingEnabled', 'false')
  return getAppSettings()
}

export async function deleteBox(id: string) {
  const box = await getBoxById(id)

  if (!box) {
    throw new BoxError('BOX_NOT_FOUND', 'Box not found')
  }

  runInTransaction((db) => {
    db.prepare('DELETE FROM boxes WHERE id = ?').run(id)
  })

  return box
}
