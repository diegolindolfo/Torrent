import { useEffect, useRef } from 'react'
import type WebTorrent from 'webtorrent'
import { fileKind } from '../lib/format'

type StreamableFile = WebTorrent.TorrentFile & {
  streamTo: (elem: HTMLMediaElement) => HTMLMediaElement
}

type Props = {
  file: WebTorrent.TorrentFile | null
}

export function Player({ file }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!file) return
    const kind = fileKind(file.name)
    const target = kind === 'audio' ? audioRef.current : videoRef.current
    if (!target) return
    try {
      ;(file as StreamableFile).streamTo(target)
      target.autoplay = true
      target.controls = true
    } catch (err) {
      console.error('Failed to stream file', err)
    }
    return () => {
      try {
        target.pause()
        target.removeAttribute('src')
        target.load()
      } catch {
        // ignore teardown errors
      }
    }
  }, [file])

  if (!file) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-800 bg-black/60 text-sm text-slate-500">
        Selecione um arquivo para reproduzir
      </div>
    )
  }

  const kind = fileKind(file.name)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
      {kind === 'audio' ? (
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-2xl">
            🎵
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-100">
              {file.name}
            </div>
            <audio
              ref={audioRef}
              controls
              className="mt-2 w-full"
              aria-label={file.name}
            />
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          controls
          className="aspect-video w-full bg-black"
          aria-label={file.name}
        />
      )}
    </div>
  )
}
