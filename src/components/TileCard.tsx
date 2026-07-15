import type { Tile } from '../types'

// Jede Kategorie bekommt deterministisch eine Farbe aus der Palette,
// damit Kacheln derselben Kategorie zusammengehörig aussehen.
const PALETTE = [
  { bg: 'bg-amber-100', accent: 'border-amber-400', text: 'text-amber-900' },
  { bg: 'bg-sky-100', accent: 'border-sky-400', text: 'text-sky-900' },
  { bg: 'bg-rose-100', accent: 'border-rose-400', text: 'text-rose-900' },
  { bg: 'bg-emerald-100', accent: 'border-emerald-400', text: 'text-emerald-900' },
  { bg: 'bg-violet-100', accent: 'border-violet-400', text: 'text-violet-900' },
  { bg: 'bg-orange-100', accent: 'border-orange-400', text: 'text-orange-900' },
]

export function categoryColor(category: string) {
  let hash = 0
  for (const ch of category) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function TileCard({
  tile,
  onDelete,
  onEdit,
}: {
  tile: Tile
  onDelete: (id: string) => void
  onEdit: (tile: Tile) => void
}) {
  const color = categoryColor(tile.category)

  return (
    <div
      // HTML5-Drag&Drop: draggable macht die Kachel greifbar; beim Start
      // legen wir die Kachel-ID in den "dataTransfer" – das ist der kleine
      // Datenkoffer, den der Browser bis zum Drop mitträgt.
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', tile.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group relative rounded-2xl border-t-4 ${color.accent} ${color.bg} shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col cursor-grab active:cursor-grabbing`}
    >
      {tile.image && (
        <img
          src={tile.image}
          alt=""
          className="w-full h-36 object-cover"
          // onError versteckt kaputte Bilder; onLoad macht das wieder
          // rückgängig, falls dieselbe Kachel später eine funktionierende
          // URL bekommt (React verwendet das DOM-Element weiter!)
          onError={(e) => (e.currentTarget.style.display = 'none')}
          onLoad={(e) => (e.currentTarget.style.display = '')}
        />
      )}
      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <h3 className={`font-semibold leading-snug ${color.text}`}>
          {tile.kind === 'link' && tile.url ? (
            <a href={tile.url} target="_blank" rel="noreferrer" className="hover:underline">
              {tile.title} ↗
            </a>
          ) : (
            tile.title
          )}
        </h3>
        {tile.description && (
          <p className="text-sm text-stone-600 leading-relaxed">{tile.description}</p>
        )}
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
        <button
          // Die Kachel selbst ist draggable. Interaktionen mit den
          // Aktionsknöpfen dürfen deshalb keinen Drag-Vorgang starten.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(tile)
          }}
          title="Kachel bearbeiten"
          aria-label="Kachel bearbeiten"
          className="w-7 h-7 rounded-full bg-white/80 text-stone-500 hover:bg-white hover:text-stone-800 text-sm leading-none"
        >
          ✎
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(tile.id)
          }}
          title="Kachel entfernen"
          aria-label="Kachel entfernen"
          className="w-7 h-7 rounded-full bg-white/80 text-stone-500 hover:bg-white hover:text-stone-800 text-sm leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
