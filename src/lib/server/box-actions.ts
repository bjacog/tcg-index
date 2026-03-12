import { createServerFn } from '@tanstack/react-start'
import {
  BoxError,
  type CreateBoxInput,
  type SetPollingEnabledInput,
  type UpdateBoxInput,
  type UpdatePollingSettingsInput,
} from '../boxes'
import {
  createBox,
  deleteBox,
  getBoxById,
  getBoxSettings,
  listBoxes,
  setPollingEnabled,
  stopScanning,
  updateBox,
  updatePollingSettings,
} from './box-repository'
import { dataDirectory, databaseFilePath } from './store'

function mapError(error: unknown): never {
  if (error instanceof BoxError) {
    throw new Error(`${error.code}: ${error.message}`)
  }

  throw error instanceof Error ? error : new Error('Unknown box error')
}

export const listBoxesFn = createServerFn({ method: 'GET' }).handler(async () => {
  return listBoxes()
})

export const getBoxByIdFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data }) => {
    const box = await getBoxById(data)
    if (!box) {
      throw new Error('BOX_NOT_FOUND: Box not found')
    }
    return box
  })

export const getBoxSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  return getBoxSettings()
})

export const getRuntimeStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  return {
    dataDirectory,
    databaseFilePath,
  }
})

export const updatePollingSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: UpdatePollingSettingsInput) => input)
  .handler(async ({ data }) => {
    try {
      return await updatePollingSettings(data)
    } catch (error) {
      mapError(error)
    }
  })

export const setPollingEnabledFn = createServerFn({ method: 'POST' })
  .inputValidator((input: SetPollingEnabledInput) => input)
  .handler(async ({ data }) => {
    try {
      return await setPollingEnabled(data)
    } catch (error) {
      mapError(error)
    }
  })

export const stopScanningFn = createServerFn({ method: 'POST' }).handler(async () => {
  return stopScanning()
})

export const createBoxFn = createServerFn({ method: 'POST' })
  .inputValidator((input: CreateBoxInput) => input)
  .handler(async ({ data }) => {
    try {
      return await createBox(data)
    } catch (error) {
      mapError(error)
    }
  })

export const updateBoxFn = createServerFn({ method: 'POST' })
  .inputValidator((input: UpdateBoxInput) => input)
  .handler(async ({ data }) => {
    try {
      return await updateBox(data)
    } catch (error) {
      mapError(error)
    }
  })

export const deleteBoxFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data }) => {
    try {
      return await deleteBox(data)
    } catch (error) {
      mapError(error)
    }
  })
