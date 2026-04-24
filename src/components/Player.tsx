import { fileKind } from '../lib/format'

type Props = {
  streamUrl: string | null
  fileName: string | null
}

export function Player({ streamUrl, fileName }: Props) {
  if (!streamUrl || !fileName) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-800 bg-black/60 text-sm text-slate-500">
        Nenhum arquivo selecionado para reprodução.
      </div>
    )
  }

  const kind = fileKind(fileName)

  if (kind === 'audio') {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <audio
          key={streamUrl}
          src={streamUrl}
          controls
          autoPlay
          className="w-full"
        />
        <p className="mt-2 truncate text-xs text-slate-500">{fileName}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
      <video
        key={streamUrl}
        src={streamUrl}
        controls
        autoPlay
        className="aspect-video w-full bg-black"
      />
    </div>
  )
}
