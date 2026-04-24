import type { TorrentFile } from '../types'
import { fileKind, formatBytes, isStreamable } from '../lib/format'

type Props = {
  files: TorrentFile[]
  selectedPath: string | null
  onSelect: (file: TorrentFile) => void
  onDownload: (file: TorrentFile) => void
}

export function FileList({ files, selectedPath, onSelect, onDownload }: Props) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Nenhum arquivo disponível ainda — aguardando metadados…
      </p>
    )
  }

  return (
    <ul className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      {files.map((f) => {
        const kind = fileKind(f.name)
        const streamable = isStreamable(f.name)
        const selected = f.path === selectedPath
        return (
          <li
            key={f.path}
            className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
              selected ? 'bg-violet-500/10' : 'hover:bg-slate-900/80'
            }`}
          >
            <span
              aria-hidden
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-300"
            >
              {kind === 'video' ? '🎬' : kind === 'audio' ? '🎵' : '📄'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-slate-100" title={f.path}>
                {f.name}
              </div>
              <div className="text-xs text-slate-500">
                {formatBytes(f.length)}
              </div>
            </div>
            {streamable ? (
              <button
                type="button"
                onClick={() => onSelect(f)}
                disabled={selected}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-default disabled:bg-slate-700"
              >
                {selected ? 'Reproduzindo' : 'Reproduzir'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDownload(f)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Baixar
            </button>
          </li>
        )
      })}
    </ul>
  )
}
