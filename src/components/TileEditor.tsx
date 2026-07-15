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
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-800">
          {tile ? 'Kachel bearbeiten' : 'Eigene Idee hinzufügen'}
        </h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Titel</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="rounded-xl border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Notiz (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-xl border border-stone-300 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
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
            className="rounded-xl border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
            className="rounded-xl border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {/* Live-Vorschau, damit man sofort sieht, ob der Link ein Bild ist */}
          {image.trim() && (
            <img
              src={image.trim()}
              alt="Vorschau"
              className="mt-1 h-24 w-full object-cover rounded-xl border border-stone-200"
              onError={(e) => (e.currentTarget.style.display = 'none')}
              onLoad={(e) => (e.currentTarget.style.display = '')}
            />
          )}
        </label>

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium px-5 py-2 transition-colors"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
