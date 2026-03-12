export {}

declare global {
  interface Window {
    tcgIndexDesktop?: {
      isElectron: boolean
      getServerOrigin: () => Promise<string | null>
      onPollingStatus: (
        callback: (payload: {
          id: string
          timestamp: string
          ok: boolean
          empty?: boolean
          message?: string
          boxResults?: Array<{
            boxCode?: string
            type?: string
            ingested?: number
          }>
        }) => void,
      ) => () => void
    }
  }
}
