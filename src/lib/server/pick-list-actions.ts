import { createServerFn } from '@tanstack/react-start'
import {
  createPickListHistory,
  getDashboardStats,
  getPickListById,
  listPickLists,
} from './pick-list-repository'

export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(async () => {
  return getDashboardStats()
})

export const listPickListsFn = createServerFn({ method: 'GET' }).handler(async () => {
  return listPickLists()
})

export const getPickListByIdFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data }) => {
    const pickList = await getPickListById(data)
    if (!pickList) {
      throw new Error('PICK_LIST_NOT_FOUND: Pick list not found')
    }
    return pickList
  })

export const createPickListHistoryFn = createServerFn({ method: 'POST' })
  .inputValidator((input: Parameters<typeof createPickListHistory>[0]) => input)
  .handler(async ({ data }) => {
    return createPickListHistory(data)
  })
