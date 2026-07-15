import { useState } from 'react'
import type { Tile } from '../types'

// Ein Formular für beides: neue eigene Kachel anlegen UND bestehende
// Kachel bearbeiten. Erscheint als Overlay über dem Board.
interface Props {
  tile: Tile | null // null = neue Kachel
  categories: string[]
  onSave: (values: {
    title: string
    description: string
    category: string
    image: string
  }) => void
  onClose: () => void
}

export function TileEditor({ tile, categories, onSave, onClose }: Props) {
  const [title, setTitle] = useState(tile?.title ?? '')
  const [description, setDescription] = useState(tile?.description ?? '')
  const [category, setCategory] = useState(tile?.category ?? categories[0] ?? 'Eigene Ideen')
  const [image, setImage] = useState(tile?.image ?? '')

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'Eigene Ideen',
      image: image.trim(),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-5 rounded-[1.75rem] border border-white bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-extrabold tracking-tight text-stone-800">
          {tile ? 'Kachel bearbeiten' : 'Eigene Idee hinzufügen'}
        </h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Titel</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Notiz (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Kategorie</span>
          {/* datalist = Freitext MIT Vorschlägen: bestehende Kategorie wählen
              oder einfach eine neue eintippen */}
          <input
            list="category-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Bild-Link (optional)</span>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://… (z.B. Rechtsklick auf ein Bild → Bildadresse kopieren)"
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
          {/* Live-Vorschau, damit man sofort sieht, ob der Link ein Bild ist */}
          {image.trim() && (
            <img
              src={image.trim()}
              alt="Vorschau"
              className="mt-1 h-24 w-full rounded-2xl border border-orange-100 object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
              onLoad={(e) => (e.currentTarget.style.display = '')}
            />
          )}
        </label>

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 font-medium text-stone-600 transition hover:bg-stone-100"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded-2xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
