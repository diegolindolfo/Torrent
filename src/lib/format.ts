export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatPercent(ratio: number): string {
  return `${(Math.max(0, Math.min(1, ratio)) * 100).toFixed(1)}%`
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const STREAMABLE_EXT = new Set([
  'mp4',
  'm4v',
  'mov',
  'webm',
  'mkv',
  'ogv',
  'ogg',
  'mp3',
  'm4a',
  'wav',
  'flac',
  'aac',
])

export function isStreamable(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return STREAMABLE_EXT.has(ext)
}

export function fileKind(name: string): 'video' | 'audio' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return 'audio'
  if (['mp4', 'm4v', 'mov', 'webm', 'mkv', 'ogv'].includes(ext)) return 'video'
  return 'other'
}
