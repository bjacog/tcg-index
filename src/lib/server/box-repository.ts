import { randomUUID } from 'node:crypto'
import {
  BoxError,
  type BoxSettings,
  type CreateBoxInput,
  type SetActiveScanningBoxInput,
  type UpdateBoxInput,
  normalizeBoxInput,
} from '../boxes'
import { ensureStore, saveStore } from './store'

export async function listBoxes() {
  const store = await ensureStore()
  return [...store.boxes].sort((a, b) => a.code.localeCompare(b.code))
}

export async function getBoxById(id: string) {
  const store = await ensureStore()
  return store.boxes.find((box) => box.id === id) ?? null
}

export async function getBoxSettings(): Promise<BoxSettings> {
  const store = await ensureStore()
  return store.settings
}

export async function createBox(input: CreateBoxInput) {
  const store = await ensureStore()
  const normalized = normalizeBoxInput(input)

  const duplicate = store.boxes.find(
    (box) => box.code.toLowerCase() === normalized.code.toLowerCase(),
  )

  if (duplicate) {
    throw new BoxError('BOX_CODE_CONFLICT', `Box code ${normalized.code} already exists`)
  }

  const timestamp = new Date().toISOString()
  const box = {
    id: randomUUID(),
    code: normalized.code,
    name: normalized.name,
    description: normalized.description,
    locationNote: normalized.locationNote,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  store.boxes.push(box)
  await saveStore(store)

  return box
}

export async function updateBox(input: UpdateBoxInput) {
  const store = await ensureStore()
  const box = store.boxes.find((entry) => entry.id === input.id)

  if (!box) {
    throw new BoxError('BOX_NOT_FOUND', 'Box not found')
  }

  const nextCode = input.code === undefined ? box.code : input.code.trim()
  const nextName = input.name === undefined ? box.name : input.name.trim()
  const nextDescription = input.description === undefined ? box.description : input.description.trim()
  const nextLocationNote = input.locationNote === undefined ? box.locationNote : input.locationNote.trim()

  if (!nextCode) {
    throw new BoxError('VALIDATION_ERROR', 'Box code is required')
  }

  if (!nextName) {
    throw new BoxError('VALIDATION_ERROR', 'Box name is required')
  }

  const duplicate = store.boxes.find(
    (entry) => entry.id !== input.id && entry.code.toLowerCase() === nextCode.toLowerCase(),
  )

  if (duplicate) {
    throw new BoxError('BOX_CODE_CONFLICT', `Box code ${nextCode} already exists`)
  }

  box.code = nextCode
  box.name = nextName
  box.description = nextDescription
  box.locationNote = nextLocationNote
  box.updatedAt = new Date().toISOString()

  await saveStore(store)

  return box
}

export async function setActiveScanningBox(input: SetActiveScanningBoxInput) {
  const store = await ensureStore()

  if (input.boxId !== null) {
    const box = store.boxes.find((entry) => entry.id === input.boxId)
    if (!box) {
      throw new BoxError('BOX_NOT_FOUND', 'Box not found')
    }
  }

  store.settings.activeScanningBoxId = input.boxId
  await saveStore(store)

  return store.settings
}

export async function deleteBox(id: string) {
  const store = await ensureStore()
  const index = store.boxes.findIndex((box) => box.id === id)

  if (index === -1) {
    throw new BoxError('BOX_NOT_FOUND', 'Box not found')
  }

  const [removed] = store.boxes.splice(index, 1)
  store.cards = store.cards.filter((card) => card.boxId !== id)

  if (store.settings.activeScanningBoxId === id) {
    store.settings.activeScanningBoxId = null
  }

  await saveStore(store)
  return removed
}
