import { createServerFn } from '@tanstack/react-start'
import { CardError } from '../cards'
import {
  appendScannedCardsToActiveBox,
  listCardsForBox,
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

export const appendScannedCardsToActiveBoxFn = createServerFn({ method: 'POST' })
  .inputValidator((cards: Parameters<typeof appendScannedCardsToActiveBox>[0]) => cards)
  .handler(async ({ data }) => {
    try {
      return await appendScannedCardsToActiveBox(data)
    } catch (error) {
      mapError(error)
    }
  })
