import { useTranslation } from 'react-i18next'
import type { Tile } from '../types'

// Jede Kategorie bekommt deterministisch eine Farbe aus der Palette,
// damit Kacheln derselben Kategorie zusammengehörig aussehen.
const PALETTE = [
  { bg: 'bg-amber-50', accent: 'border-amber-400', text: 'text-amber-950' },
  { bg: 'bg-sky-50', accent: 'border-sky-400', text: 'text-sky-950' },
  { bg: 'bg-rose-50', accent: 'border-rose-400', text: 'text-rose-950' },
  { bg: 'bg-emerald-50', accent: 'border-emerald-400', text: 'text-emerald-950' },
  { bg: 'bg-violet-50', accent: 'border-violet-400', text: 'text-violet-950' },
  { bg: 'bg-orange-50', accent: 'border-orange-400', text: 'text-orange-950' },
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
  onToggleSelected,
}: {
  tile: Tile
  onDelete: (id: string) => void
  onEdit: (tile: Tile) => void
  onToggleSelected: (id: string) => void
}) {
  const { t } = useTranslation()
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
      className={`group relative flex cursor-grab flex-col overflow-hidden rounded-[1.5rem] border border-white border-t-4 ${color.accent} ${
        tile.selected ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-white' : ''
      } ${color.bg} shadow-[0_8px_22px_rgba(91,58,36,0.09)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(91,58,36,0.14)] active:cursor-grabbing`}
    >
      {tile.image && (
        <img
          src={tile.image}
          alt=""
          className="h-40 w-full object-cover"
          // onError versteckt kaputte Bilder; onLoad macht das wieder
          // rückgängig, falls dieselbe Kachel später eine funktionierende
          // URL bekommt (React verwendet das DOM-Element weiter!)
          onError={(e) => (e.currentTarget.style.display = 'none')}
          onLoad={(e) => (e.currentTarget.style.display = '')}
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className={`pr-9 text-lg font-bold leading-snug ${color.text}`}>
          {tile.kind === 'link' && tile.url ? (
            <a href={tile.url} target="_blank" rel="noreferrer" className="hover:underline">
              {tile.title} ↗
            </a>
          ) : (
            tile.title
          )}
        </h3>
        {tile.description && (
          <p className="text-sm leading-relaxed text-stone-600">{tile.description}</p>
        )}
      </div>
      <div className="absolute right-3 top-3 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelected(tile.id)
          }}
          title={tile.selected ? t('common.unselected') : t('common.selected')}
          aria-label={tile.selected ? t('common.unselected') : t('common.selected')}
          className={`h-8 w-8 rounded-full bg-white/90 text-sm leading-none shadow-sm transition hover:bg-white ${
            tile.selected ? 'text-amber-500 hover:text-amber-600' : 'text-stone-500 hover:text-amber-600'
          }`}
        >
          {tile.selected ? '★' : '☆'}
        </button>
        <button
          // Die Kachel selbst ist draggable. Interaktionen mit den
          // Aktionsknöpfen dürfen deshalb keinen Drag-Vorgang starten.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(tile)
          }}
          title={t('dialog.tileEditTitle')}
          aria-label={t('dialog.tileEditTitle')}
          className="h-8 w-8 rounded-full bg-white/90 text-sm leading-none text-stone-500 shadow-sm transition hover:bg-white hover:text-orange-700"
        >
          ✎
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(tile.id)
          }}
          title={t('common.remove')}
          aria-label={t('common.remove')}
          className="h-8 w-8 rounded-full bg-white/90 text-sm leading-none text-stone-500 shadow-sm transition hover:bg-white hover:text-rose-600"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
