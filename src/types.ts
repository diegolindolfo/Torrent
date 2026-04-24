export type TorrentFile = {
  name: string
  path: string
  length: number
}

export type TorrentStats = {
  name: string
  infoHash: string
  magnetURI: string
  length: number
  downloaded: number
  uploaded: number
  downloadSpeed: number
  uploadSpeed: number
  progress: number
  numPeers: number
  timeRemaining: number
  done: boolean
}
