import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [title, setTitle] = useState(tile?.title ?? '')
  const [description, setDescription] = useState(tile?.description ?? '')
  const [category, setCategory] = useState(tile?.category ?? categories[0] ?? t('dialog.ownIdeas'))
  const [image, setImage] = useState(tile?.image ?? '')

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || t('dialog.ownIdeas'),
      image: image.trim(),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/30 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-[1.75rem] border border-white bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0">
          <h2 className="text-xl font-extrabold tracking-tight text-stone-800">
            {tile ? t('dialog.tileEditTitle') : t('dialog.tileNewTitle')}
          </h2>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-600">{t('dialog.title')}</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-600">{t('dialog.note')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-600">{t('dialog.category')}</span>
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
            <span className="text-sm font-medium text-stone-600">{t('dialog.imageLink')}</span>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder={t('dialog.imageLink')}
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
        </div>

        <div className="shrink-0 mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 font-medium text-stone-600 transition hover:bg-stone-100"
          >
            {t('common.cancel')}
          </button>
          <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="rounded-2xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40"
        >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
