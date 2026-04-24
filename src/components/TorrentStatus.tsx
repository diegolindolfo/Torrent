import type { TorrentStats } from '../lib/api'
import {
  formatBytes,
  formatEta,
  formatPercent,
  formatSpeed,
} from '../lib/format'

type Props = {
  stats: TorrentStats
  onRemove: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-slate-100">{value}</div>
    </div>
  )
}

export function TorrentStatus({ stats, onRemove }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-base font-medium text-slate-100">
            {stats.name || 'Carregando metadados…'}
          </div>
          <div
            className="mt-1 truncate font-mono text-xs text-slate-500"
            title={stats.infoHash}
          >
            {stats.infoHash || '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
        >
          Remover
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Progresso</span>
          <span>
            {formatBytes(stats.downloaded)} / {formatBytes(stats.length)} (
            {formatPercent(stats.progress)})
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(1, stats.progress)) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Peers" value={String(stats.numPeers)} />
        <Stat label="Download" value={formatSpeed(stats.downloadSpeed)} />
        <Stat label="Upload" value={formatSpeed(stats.uploadSpeed)} />
        <Stat
          label="Restante"
          value={stats.done ? 'Concluído' : formatEta(stats.timeRemaining / 1000)}
        />
      </div>
    </div>
  )
}
