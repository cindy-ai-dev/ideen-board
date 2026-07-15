import { useMemo, useState } from 'react'
import type { ShoppingListItem } from '../types'

const DEFAULT_SECTIONS = ['Deko', 'Essen', 'Getränke', 'Geschirr', 'Sonstiges']

function normalizeSection(section: string): string {
  return section.trim() || 'Sonstiges'
}

function groupItems(items: ShoppingListItem[]) {
  const map = new Map<string, ShoppingListItem[]>()
  for (const item of items) {
    const section = normalizeSection(item.section)
    const list = map.get(section) ?? []
    list.push({ ...item, section })
    map.set(section, list)
  }
  return [...map.entries()]
}

interface Props {
  items: ShoppingListItem[]
  editable?: boolean
  generating?: boolean
  selectedIdeasCount?: number
  onGenerate?: () => void
  onToggleItem?: (id: string) => void
  onAddItem?: (item: { label: string; section: string }) => void
  onRemoveItem?: (id: string) => void
}

export function ShoppingListSection({
  items,
  editable = false,
  generating = false,
  selectedIdeasCount = 0,
  onGenerate,
  onToggleItem,
  onAddItem,
  onRemoveItem,
}: Props) {
  const [label, setLabel] = useState('')
  const [section, setSection] = useState('Sonstiges')

  const grouped = useMemo(() => groupItems(items), [items])
  const canGenerate = selectedIdeasCount > 0 && typeof onGenerate === 'function'

  function handleAdd() {
    const nextLabel = label.trim()
    const nextSection = normalizeSection(section)
    if (!nextLabel || !onAddItem) return
    onAddItem({ label: nextLabel, section: nextSection })
    setLabel('')
    setSection(nextSection)
  }

  return (
    <section className="rounded-[1.75rem] border border-orange-100 bg-white/85 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] print:rounded-none print:border print:border-stone-300 print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 print:text-stone-500">
            Einkaufsliste
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 print:text-black">
            Konkrete Einkaufspunkte
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 print:text-stone-700">
            Ausgewählte Ideen werden per KI in Einkaufsposten übersetzt. Manuelle Ergänzungen
            kannst du jederzeit hinzufügen.
          </p>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={onGenerate}
              disabled={!canGenerate || generating}
              className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600 disabled:opacity-40"
            >
              {generating ? 'Generiert…' : items.length > 0 ? 'Liste aktualisieren' : 'Liste generieren'}
            </button>
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-4 rounded-[1.35rem] border border-amber-100 bg-amber-50/60 p-4 print:hidden">
          <div className="flex flex-col gap-2 lg:flex-row">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Eigenen Artikel hinzufügen"
              className="flex-1 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              list="shopping-sections"
              placeholder="Bereich"
              className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100 lg:max-w-52"
            />
            <datalist id="shopping-sections">
              {DEFAULT_SECTIONS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <button
              onClick={handleAdd}
              disabled={!label.trim()}
              className="rounded-2xl bg-stone-800 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-40"
            >
              Hinzufügen
            </button>
          </div>
          {selectedIdeasCount === 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Für die KI-Liste müssen zuerst Ideen-Kacheln als ausgewählt markiert sein.
            </p>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center text-sm text-stone-500 print:border-stone-300 print:bg-white print:text-stone-700">
          Noch keine Einkaufsliste vorhanden.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {grouped.map(([sectionName, sectionItems]) => (
            <section
              key={sectionName}
              className="rounded-[1.35rem] border border-orange-100 bg-orange-50/40 p-4 print:rounded-none print:border-stone-300 print:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="inline-block rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-orange-700 print:border print:border-stone-300 print:bg-white print:text-black">
                  {sectionName}
                </h4>
                <span className="text-xs font-semibold text-stone-500 print:text-stone-700">
                  {sectionItems.length} Posten
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {sectionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white px-3 py-3 print:border-stone-200 print:bg-white print:break-inside-avoid"
                  >
                    {editable && onToggleItem ? (
                      <button
                        onClick={() => onToggleItem(item.id)}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm transition ${
                          item.checked
                            ? 'border-amber-400 bg-amber-100 text-amber-700'
                            : 'border-stone-300 bg-white text-stone-400 hover:border-amber-300 hover:text-amber-600'
                        }`}
                        aria-label={item.checked ? 'Als nicht gekauft markieren' : 'Als gekauft markieren'}
                        title={item.checked ? 'Als nicht gekauft markieren' : 'Als gekauft markieren'}
                      >
                        {item.checked ? '✓' : ''}
                      </button>
                    ) : (
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
                          item.checked
                            ? 'border-amber-400 bg-amber-100 text-amber-700'
                            : 'border-stone-300 bg-white text-stone-400'
                        }`}
                        aria-hidden="true"
                      >
                        {item.checked ? '✓' : ''}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold leading-snug ${
                          item.checked ? 'text-stone-400 line-through' : 'text-stone-800'
                        } print:text-black print:no-underline`}
                      >
                        {item.label}
                      </p>
                      {item.note && (
                        <p className="mt-1 text-sm text-stone-500 print:text-stone-700">{item.note}</p>
                      )}
                    </div>

                    {editable && onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="rounded-full px-2 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 print:hidden"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
