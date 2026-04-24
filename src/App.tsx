import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { FileList } from './components/FileList'
import { Player } from './components/Player'
import { TorrentStatus } from './components/TorrentStatus'
import {
  addMagnet,
  addTorrentFile,
  fileStreamUrl,
  removeTorrent,
  subscribeToStats,
  type TorrentFile,
  type TorrentStats,
} from './lib/api'
import { isStreamable } from './lib/format'

const SINTEL_MAGNET =
  'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent'

function pickInitialFile(files: TorrentFile[]): TorrentFile | null {
  const ordered = [...files].sort((a, b) => {
    const sa = isStreamable(a.name) ? 0 : 1
    const sb = isStreamable(b.name) ? 0 : 1
    if (sa !== sb) return sa - sb
    return b.length - a.length
  })
  return ordered.find((f) => isStreamable(f.name)) ?? null
}

function App() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<TorrentStats | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const cancelStreamRef = useRef<(() => void) | null>(null)

  const cancelStats = useCallback(() => {
    cancelStreamRef.current?.()
    cancelStreamRef.current = null
  }, [])

  const attach = useCallback(
    (initial: TorrentStats) => {
      setStats(initial)
      const first = pickInitialFile(initial.files)
      setSelectedPath(first?.path ?? null)
      setStatus('ready')
      cancelStats()
      cancelStreamRef.current = subscribeToStats(
        initial.infoHash,
        (data) => setStats(data),
        (err) => console.warn('[stats] stream error:', err.message),
      )
    },
    [cancelStats],
  )

  const addSource = useCallback(
    async (source: string | File) => {
      setError(null)
      setStatus('loading')
      cancelStats()
      try {
        const result =
          typeof source === 'string'
            ? await addMagnet(source)
            : await addTorrentFile(source)
        attach(result)
      } catch (err) {
        console.error('Failed to add torrent:', err)
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    },
    [attach, cancelStats],
  )

  const handleReset = useCallback(async () => {
    const current = stats
    cancelStats()
    setStats(null)
    setSelectedPath(null)
    setError(null)
    setStatus('idle')
    if (current) {
      try {
        await removeTorrent(current.infoHash)
      } catch (err) {
        console.warn('Failed to remove torrent on server:', err)
      }
    }
  }, [cancelStats, stats])

  useEffect(() => () => cancelStats(), [cancelStats])

  const files = stats?.files ?? []
  const selectedFile = files.find((f) => f.path === selectedPath) ?? null
  const selectedStreamUrl = stats && selectedFile
    ? fileStreamUrl(stats.infoHash, selectedFile.path)
    : null

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg">
              ▶
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">
                Torrent Player
              </h1>
              <p className="text-xs text-slate-500">
                Streaming híbrido (WebRTC + TCP/UDP) via backend
              </p>
            </div>
          </div>
          <a
            href="https://github.com/diegolindolfo/Torrent"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <DropZone
          onMagnet={(m) => addSource(m)}
          onFile={(f) => addSource(f)}
          disabled={status === 'loading'}
        />

        {status === 'loading' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              Adicionando torrent e buscando metadados no servidor…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-medium">Erro ao carregar torrent</div>
            <div className="mt-1 text-xs text-red-200/80">{error}</div>
          </div>
        )}

        {stats && <TorrentStatus stats={stats} onRemove={handleReset} />}

        {status === 'ready' && stats && (
          <>
            <Player
              streamUrl={selectedStreamUrl}
              fileName={selectedFile?.name ?? null}
            />
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
                Arquivos ({files.length})
              </h2>
              <FileList
                files={files}
                selectedPath={selectedPath}
                onSelect={(f) => setSelectedPath(f.path)}
                downloadUrl={(f) => fileStreamUrl(stats.infoHash, f.path)}
              />
            </section>
          </>
        )}

        {status === 'idle' && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
            <h2 className="text-base font-medium text-slate-100">Como usar</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Cole um magnet link ou solte um arquivo .torrent.</li>
              <li>
                O backend baixa os metadados e se conecta a peers
                (WebRTC + TCP/UDP).
              </li>
              <li>
                Escolha um arquivo de vídeo ou áudio para reproduzir
                in-browser via HTTP.
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              Experimente com o torrent oficial Sintel da Blender:{' '}
              <button
                type="button"
                onClick={() => addSource(SINTEL_MAGNET)}
                className="font-mono text-violet-300 underline-offset-4 hover:underline"
              >
                carregar Sintel (magnet)
              </button>
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Torrent Player · feito com React, Vite, Tailwind e{' '}
        <a
          href="https://webtorrent.io"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:text-slate-300 hover:underline"
        >
          WebTorrent
        </a>
      </footer>
    </div>
  )
}

export default App
