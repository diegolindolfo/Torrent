import { useCallback, useEffect, useRef, useState } from 'react'
import type WebTorrent from 'webtorrent'
import { DropZone } from './components/DropZone'
import { FileList } from './components/FileList'
import { Player } from './components/Player'
import { TorrentStatus } from './components/TorrentStatus'
import { ensureStreamingServer, getClient } from './lib/client'
import { isStreamable } from './lib/format'
import type { TorrentFile, TorrentStats } from './types'

function toStats(t: WebTorrent.Torrent): TorrentStats {
  return {
    name: t.name ?? '',
    infoHash: t.infoHash ?? '',
    magnetURI: t.magnetURI ?? '',
    length: t.length ?? 0,
    downloaded: t.downloaded ?? 0,
    uploaded: t.uploaded ?? 0,
    downloadSpeed: t.downloadSpeed ?? 0,
    uploadSpeed: t.uploadSpeed ?? 0,
    progress: t.progress ?? 0,
    numPeers: t.numPeers ?? 0,
    timeRemaining: t.timeRemaining ?? 0,
    done: t.done ?? false,
  }
}

function toFiles(t: WebTorrent.Torrent): TorrentFile[] {
  return t.files.map((f) => ({ name: f.name, path: f.path, length: f.length }))
}

function App() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<TorrentStats | null>(null)
  const [files, setFiles] = useState<TorrentFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] =
    useState<WebTorrent.TorrentFile | null>(null)

  const torrentRef = useRef<WebTorrent.Torrent | null>(null)
  const pollRef = useRef<number | null>(null)

  const startPolling = useCallback((t: WebTorrent.Torrent) => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(() => {
      setStats(toStats(t))
    }, 1000)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const attachTorrent = useCallback(
    (t: WebTorrent.Torrent) => {
      torrentRef.current = t

      const onReady = () => {
        setStats(toStats(t))
        const ordered = [...t.files].sort((a, b) => {
          const sa = isStreamable(a.name) ? 0 : 1
          const sb = isStreamable(b.name) ? 0 : 1
          if (sa !== sb) return sa - sb
          return b.length - a.length
        })
        setFiles(toFiles(t))
        const firstPlayable = ordered.find((f) => isStreamable(f.name))
        if (firstPlayable) {
          setSelectedFile(firstPlayable)
          setSelectedPath(firstPlayable.path)
        }
        setStatus('ready')
        startPolling(t)
      }

      if (t.ready) {
        onReady()
      } else {
        t.on('ready', onReady)
      }

      t.on('error', (err: Error | string) => {
        console.error('Torrent error:', err)
        setError(typeof err === 'string' ? err : err.message)
        setStatus('error')
      })
      t.on('warning', (err: Error | string) => {
        console.warn('Torrent warning:', err)
      })
      t.on('done', () => setStats(toStats(t)))
    },
    [startPolling],
  )

  const resetTorrent = useCallback(() => {
    stopPolling()
    const t = torrentRef.current
    torrentRef.current = null
    setStats(null)
    setFiles([])
    setSelectedFile(null)
    setSelectedPath(null)
    setError(null)
    setStatus('idle')
    if (t) {
      try {
        t.destroy()
      } catch (err) {
        console.error('Error destroying torrent:', err)
      }
    }
  }, [stopPolling])

  const addSource = useCallback(
    async (source: string | File) => {
      setError(null)
      setStatus('loading')
      try {
        await ensureStreamingServer()
        const client = getClient()
        if (torrentRef.current) {
          try {
            torrentRef.current.destroy()
          } catch {
            // ignore
          }
          torrentRef.current = null
          stopPolling()
        }
        client.add(source as string, (torrent) => {
          attachTorrent(torrent)
        })
      } catch (err) {
        console.error('Failed to add torrent:', err)
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    },
    [attachTorrent, stopPolling],
  )

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  const handleSelect = useCallback(
    (file: TorrentFile) => {
      const wtFile = torrentRef.current?.files.find((f) => f.path === file.path)
      if (!wtFile) return
      setSelectedFile(wtFile)
      setSelectedPath(file.path)
    },
    [],
  )

  const handleDownload = useCallback((file: TorrentFile) => {
    const wtFile = torrentRef.current?.files.find((f) => f.path === file.path)
    if (!wtFile) return
    wtFile.getBlobURL((err, url) => {
      if (err || !url) {
        console.error('Failed to build blob url', err)
        return
      }
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    })
  }, [])

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
                Streaming via WebTorrent — roda 100% no navegador
              </p>
            </div>
          </div>
          <a
            href="https://github.com/diegolindolfo/torrent-player"
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
              Conectando a peers e buscando metadados…
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Dica: torrents só funcionam se houver peers WebRTC
              (outros navegadores/WebTorrent) compartilhando esse conteúdo.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-medium">Erro ao carregar torrent</div>
            <div className="mt-1 text-xs text-red-200/80">{error}</div>
          </div>
        )}

        {stats && (
          <TorrentStatus stats={stats} onRemove={resetTorrent} />
        )}

        {status === 'ready' && (
          <>
            <Player file={selectedFile} />
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
                Arquivos ({files.length})
              </h2>
              <FileList
                files={files}
                selectedPath={selectedPath}
                onSelect={handleSelect}
                onDownload={handleDownload}
              />
            </section>
          </>
        )}

        {status === 'idle' && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
            <h2 className="text-base font-medium text-slate-100">
              Como usar
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Cole um magnet link ou solte um arquivo .torrent.</li>
              <li>
                Aguarde o download dos metadados e a conexão com peers WebRTC.
              </li>
              <li>
                Escolha um arquivo de vídeo ou áudio para reproduzir in-browser.
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              Experimente com o torrent oficial Sintel da Blender:{' '}
              <button
                type="button"
                onClick={() =>
                  addSource(
                    'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent',
                  )
                }
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
