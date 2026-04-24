// Thin client over the torrent-player backend API. The backend handles the
// actual BitTorrent connections (TCP/UDP/WebRTC) and exposes an HTTP API plus
// Range streaming for files.

export type TorrentFile = {
  name: string
  path: string
  length: number
}

export type TorrentStats = {
  infoHash: string
  name: string
  magnetURI: string
  length: number
  progress: number
  downloaded: number
  uploaded: number
  downloadSpeed: number
  uploadSpeed: number
  numPeers: number
  timeRemaining: number
  done: boolean
  files: TorrentFile[]
}

function apiBase(): string {
  // VITE_API_BASE can point at a remote backend in production builds.
  // Defaults to a same-origin `/api` path (typical behind a reverse proxy),
  // and falls back to the local dev backend on :8787 when running `npm run
  // dev` without a proxy.
  const env = import.meta.env.VITE_API_BASE as string | undefined
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:8787'
  }
  return ''
}

function apiUrl(path: string): string {
  return `${apiBase()}${path}`
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed?.error) message = parsed.error
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export async function addMagnet(magnet: string): Promise<TorrentStats> {
  const res = await fetch(apiUrl('/api/torrents'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ magnet }),
  })
  return handleJson<TorrentStats>(res)
}

export async function addTorrentFile(file: File): Promise<TorrentStats> {
  const form = new FormData()
  form.append('torrent', file)
  const res = await fetch(apiUrl('/api/torrents/file'), {
    method: 'POST',
    body: form,
  })
  return handleJson<TorrentStats>(res)
}

export async function removeTorrent(infoHash: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/torrents/${infoHash}`), {
    method: 'DELETE',
  })
  await handleJson<{ ok: true }>(res)
}

/** Subscribe to a live stats stream via SSE. Returns a cancel function. */
export function subscribeToStats(
  infoHash: string,
  onStats: (stats: TorrentStats) => void,
  onError?: (err: Error) => void,
): () => void {
  const url = apiUrl(`/api/torrents/${infoHash}/events`)
  const source = new EventSource(url)
  source.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as TorrentStats
      onStats(data)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }
  source.onerror = () => {
    onError?.(new Error('Conexão SSE perdida'))
  }
  return () => source.close()
}

export function fileStreamUrl(infoHash: string, filePath: string): string {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return apiUrl(`/api/torrents/${infoHash}/files/${encoded}`)
}
