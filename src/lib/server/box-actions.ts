import { createServerFn } from '@tanstack/react-start'
import { BoxError, type CreateBoxInput, type UpdateBoxInput } from '../boxes'
import { createBox, deleteBox, getBoxById, listBoxes, updateBox } from './box-repository'

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
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    const box = await getBoxById(data)
    if (!box) {
      throw new Error('BOX_NOT_FOUND: Box not found')
    }
    return box
  })

export const createBoxFn = createServerFn({ method: 'POST' })
  .validator((input: CreateBoxInput) => input)
  .handler(async ({ data }) => {
    try {
      return await createBox(data)
    } catch (error) {
      mapError(error)
    }
  })

export const updateBoxFn = createServerFn({ method: 'POST' })
  .validator((input: UpdateBoxInput) => input)
  .handler(async ({ data }) => {
    try {
      return await updateBox(data)
    } catch (error) {
      mapError(error)
    }
  })

export const deleteBoxFn = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    try {
      return await deleteBox(data)
    } catch (error) {
      mapError(error)
    }
  })
