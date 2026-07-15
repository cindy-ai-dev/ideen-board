import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Kleiner Dialog für einen einzelnen Namen – genutzt für
// "Neues Board" und "Board umbenennen".
interface Props {
  title: string
  initial?: string
  onSave: (name: string) => void
  onClose: () => void
}

export function NameDialog({ title, initial = '', onSave, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial)

  function handleSave() {
    if (!name.trim()) return
    onSave(name.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-5 rounded-[1.75rem] border border-white bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-extrabold tracking-tight text-stone-800">{title}</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder={t('dialog.namePlaceholder')}
          className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
        />
        <div className="flex justify-end gap-2">
          <button
          onClick={onClose}
          className="rounded-2xl px-4 py-2.5 font-medium text-stone-600 transition hover:bg-stone-100"
        >
            {t('common.cancel')}
          </button>
          <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="rounded-2xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40"
        >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
