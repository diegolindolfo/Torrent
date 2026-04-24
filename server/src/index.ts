import express, { type Request, type Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import type { Readable } from 'node:stream'
import WebTorrent, { type Instance, type Torrent, type TorrentFile } from 'webtorrent'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '0.0.0.0'
// Comma-separated list of allowed origins. Defaults to permissive for dev.
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) ?? '*'

const client: Instance = new WebTorrent()

client.on('error', (err) => {
  console.error('[webtorrent] client error:', err)
})

const app = express()
app.use(cors({ origin: CORS_ORIGINS, credentials: false }))
app.use(express.json({ limit: '1mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

/** Wait for the torrent to emit metadata (files list resolved). */
function waitForMetadata(torrent: Torrent, timeoutMs = 60_000): Promise<Torrent> {
  if (torrent.files.length > 0) return Promise.resolve(torrent)
  return new Promise((resolve, reject) => {
    const onMetadata = () => {
      cleanup()
      resolve(torrent)
    }
    const onError = (err: Error | string) => {
      cleanup()
      reject(err instanceof Error ? err : new Error(String(err)))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for metadata`))
    }, timeoutMs)
    function cleanup() {
      clearTimeout(timer)
      torrent.off('metadata', onMetadata)
      torrent.off('error', onError)
    }
    torrent.once('metadata', onMetadata)
    torrent.once('error', onError)
  })
}

function serializeTorrent(t: Torrent) {
  return {
    infoHash: t.infoHash,
    name: t.name,
    magnetURI: t.magnetURI,
    length: t.length,
    progress: t.progress,
    downloaded: t.downloaded,
    uploaded: t.uploaded,
    downloadSpeed: t.downloadSpeed,
    uploadSpeed: t.uploadSpeed,
    numPeers: t.numPeers,
    timeRemaining: t.timeRemaining,
    done: t.done,
    files: t.files.map((f) => ({
      name: f.name,
      path: f.path,
      length: f.length,
    })),
  }
}

function findFile(t: Torrent, filePath: string): TorrentFile | undefined {
  // Incoming `filePath` is URL-decoded by Express. It matches `file.path`
  // exactly (WebTorrent stores forward-slash separated paths).
  return t.files.find((f) => f.path === filePath)
}

/** Add a torrent if not already added. Returns existing torrent if present. */
async function addTorrent(source: string | Buffer): Promise<Torrent> {
  const existing =
    typeof source === 'string'
      ? client.torrents.find((t) => t.magnetURI === source || source.includes(t.infoHash))
      : undefined
  if (existing) return waitForMetadata(existing)

  return new Promise<Torrent>((resolve, reject) => {
    const torrent = client.add(source, { path: undefined }, (t) => {
      resolve(t)
    })
    torrent.once('error', reject)
  }).then((t) => waitForMetadata(t))
}

async function getTorrent(id: string): Promise<Torrent | undefined> {
  const t = await client.get(id)
  return t ?? undefined
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, torrents: client.torrents.length })
})

// List current torrents
app.get('/api/torrents', (_req, res) => {
  res.json({ torrents: client.torrents.map(serializeTorrent) })
})

// Add via magnet (JSON body { magnet })
app.post('/api/torrents', async (req: Request, res: Response) => {
  const { magnet } = req.body ?? {}
  if (typeof magnet !== 'string' || magnet.length < 4) {
    res.status(400).json({ error: 'body.magnet deve ser uma string com magnet ou infohash' })
    return
  }
  try {
    const torrent = await addTorrent(magnet)
    res.status(201).json(serializeTorrent(torrent))
  } catch (err) {
    console.error('[add magnet] error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Add via .torrent file upload (multipart form, field "torrent")
app.post(
  '/api/torrents/file',
  upload.single('torrent'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'arquivo .torrent ausente no campo "torrent"' })
      return
    }
    try {
      const torrent = await addTorrent(req.file.buffer)
      res.status(201).json(serializeTorrent(torrent))
    } catch (err) {
      console.error('[add file] error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

// Get a single torrent's metadata + live stats
app.get('/api/torrents/:infoHash', async (req, res) => {
  const torrent = await getTorrent(req.params.infoHash)
  if (!torrent) {
    res.status(404).json({ error: 'torrent não encontrado' })
    return
  }
  res.json(serializeTorrent(torrent))
})

// Server-sent events stream of stats every second
app.get('/api/torrents/:infoHash/events', async (req, res) => {
  const torrent = await getTorrent(req.params.infoHash)
  if (!torrent) {
    res.status(404).json({ error: 'torrent não encontrado' })
    return
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  const send = () => {
    res.write(`data: ${JSON.stringify(serializeTorrent(torrent))}\n\n`)
  }
  send()
  const interval = setInterval(send, 1000)
  req.on('close', () => {
    clearInterval(interval)
    res.end()
  })
})

// Remove a torrent
app.delete('/api/torrents/:infoHash', async (req, res) => {
  const torrent = await getTorrent(req.params.infoHash)
  if (!torrent) {
    res.status(404).json({ error: 'torrent não encontrado' })
    return
  }
  client.remove(torrent.infoHash, { destroyStore: true }, (err) => {
    if (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
      return
    }
    res.json({ ok: true })
  })
})

// HTTP Range streaming for a single file. The `filePath` segment is a
// wildcard so nested paths (season/episode/file.mkv) are preserved.
app.get('/api/torrents/:infoHash/files/*filePath', async (req, res) => {
  const torrent = await getTorrent(req.params.infoHash)
  if (!torrent) {
    res.status(404).json({ error: 'torrent não encontrado' })
    return
  }
  const pathParam = req.params.filePath
  const rawPath = Array.isArray(pathParam) ? pathParam.join('/') : pathParam
  const filePath = decodeURIComponent(rawPath ?? '')
  const file = findFile(torrent, filePath)
  if (!file) {
    res.status(404).json({ error: 'arquivo não encontrado dentro do torrent' })
    return
  }

  const range = req.headers.range
  const total = file.length
  let start = 0
  let end = total - 1

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (match) {
      const [, s, e] = match
      if (s !== '') start = Number(s)
      if (e !== '') end = Number(e)
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
        res
          .status(416)
          .set('Content-Range', `bytes */${total}`)
          .end()
        return
      }
    }
  }

  const chunkSize = end - start + 1
  res.status(range ? 206 : 200)
  res.set({
    'Content-Type': guessContentType(file.name),
    'Content-Length': String(chunkSize),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  })
  if (range) {
    res.set('Content-Range', `bytes ${start}-${end}/${total}`)
  }

  const stream = file.createReadStream({ start, end }) as unknown as Readable
  stream.on('error', (err: Error) => {
    console.error('[stream] error for', file.path, err)
    if (!res.headersSent) res.sendStatus(500)
    res.end()
  })
  req.on('close', () => stream.destroy())
  stream.pipe(res)
})

const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
}

function guessContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

app.listen(PORT, HOST, () => {
  console.log(`[server] torrent-player backend listening on http://${HOST}:${PORT}`)
})
