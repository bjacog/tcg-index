export type PickListHistoryRecord = {
  id: string
  createdAt: string
  requestedCards: string[]
  missingCards: string[]
  resultSnapshot: PickListBoxGroup[]
}

export type PickListBoxGroup = {
  box: string
  cards: PickListCardEntry[]
}

export type PickListCardEntry = {
  name: string
  position: number
}

export type DashboardStats = {
  boxCount: number
  indexedCardCount: number
  uniqueCardNameCount: number
  pickListCount: number
}
