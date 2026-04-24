import { useCallback, useRef, useState } from 'react'

type Props = {
  onMagnet: (magnet: string) => void
  onFile: (file: File) => void
  disabled?: boolean
}

export function DropZone({ onMagnet, onFile, disabled }: Props) {
  const [magnet, setMagnet] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.torrent')) {
        alert('Por favor, selecione um arquivo .torrent')
        return
      }
      onFile(file)
    },
    [onFile],
  )

  const submitMagnet = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = magnet.trim()
    if (!trimmed) return
    if (
      !trimmed.startsWith('magnet:') &&
      !trimmed.startsWith('http') &&
      !/^[0-9a-f]{40}$/i.test(trimmed)
    ) {
      alert('Cole um magnet link válido (magnet:?xt=urn:btih:...) ou um infohash.')
      return
    }
    onMagnet(trimmed)
    setMagnet('')
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitMagnet} className="flex gap-2">
        <input
          type="text"
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          placeholder="Cole um magnet link (magnet:?xt=urn:btih:...) ou infohash"
          disabled={disabled}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || !magnet.trim()}
          className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          Adicionar
        </button>
      </form>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (disabled) return
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragging
            ? 'border-violet-400 bg-violet-500/10'
            : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/60'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Solte um arquivo .torrent ou clique para selecionar"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".torrent,application/x-bittorrent"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-sm text-slate-300">
          <span className="font-medium text-slate-100">
            Solte um arquivo .torrent
          </span>{' '}
          ou clique para selecionar
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Também aceita magnet links no campo acima
        </div>
      </div>
    </div>
  )
}
