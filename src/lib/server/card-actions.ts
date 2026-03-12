import { createServerFn } from '@tanstack/react-start'
import { CardError } from '../cards'
import type { PickCardsInput, ReturnCardsInput } from '../pick-lists'
import {
  appendScannedCardsToBox,
  listCardsForBox,
  pickCardsIntoProject,
  returnCardsFromProject,
  searchCardsByExactNames,
} from './card-repository'

function mapError(error: unknown): never {
  if (error instanceof CardError) {
    throw new Error(`${error.code}: ${error.message}`)
  }

  throw error instanceof Error ? error : new Error('Unknown card error')
}

export const listCardsForBoxFn = createServerFn({ method: 'GET' })
  .inputValidator((boxId: string) => boxId)
  .handler(async ({ data }) => listCardsForBox(data))

export const searchCardsByExactNamesFn = createServerFn({ method: 'POST' })
  .inputValidator((names: string[]) => names)
  .handler(async ({ data }) => searchCardsByExactNames(data))

export const appendScannedCardsToBoxFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { boxId: string; cards: Parameters<typeof appendScannedCardsToBox>[1] }) => input)
  .handler(async ({ data }) => {
    try {
      return await appendScannedCardsToBox(data.boxId, data.cards)
    } catch (error) {
      mapError(error)
    }
  })

export const pickCardsIntoProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: PickCardsInput) => input)
  .handler(async ({ data }) => {
    try {
      return await pickCardsIntoProject(data)
    } catch (error) {
      mapError(error)
    }
  })

export const returnCardsFromProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: ReturnCardsInput) => input)
  .handler(async ({ data }) => {
    try {
      return await returnCardsFromProject(data)
    } catch (error) {
      mapError(error)
    }
  })
