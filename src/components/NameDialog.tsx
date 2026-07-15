import { useState } from 'react'

// Kleiner Dialog für einen einzelnen Namen – genutzt für
// "Neues Board" und "Board umbenennen".
interface Props {
  title: string
  initial?: string
  onSave: (name: string) => void
  onClose: () => void
}

export function NameDialog({ title, initial = '', onSave, onClose }: Props) {
  const [name, setName] = useState(initial)

  function handleSave() {
    if (!name.trim()) return
    onSave(name.trim())
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder='z.B. "Renovierung Bad"'
          className="rounded-xl border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium px-5 py-2 transition-colors"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
