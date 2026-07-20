import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartyDetails } from '../types'
import type { ShoppingListItem } from '../types'

function normalizeSection(section: string, fallback: string): string {
  const trimmed = section.trim()
  if (!trimmed || trimmed === 'Sonstiges' || trimmed === 'Misc') return fallback
  return trimmed
}

function groupItems(items: ShoppingListItem[], fallback: string) {
  const map = new Map<string, ShoppingListItem[]>()
  for (const item of items) {
    const section = normalizeSection(item.section, fallback)
    const list = map.get(section) ?? []
    list.push({ ...item, section })
    map.set(section, list)
  }
  return [...map.entries()]
}

interface Props {
  items: ShoppingListItem[]
  partyDetails?: Pick<PartyDetails, 'budgetLimitEuro'>
  editable?: boolean
  generating?: boolean
  errorMessage?: string | null
  selectedIdeasCount?: number
  onGenerate?: () => void
  onToggleItem?: (id: string) => void
  onAddItem?: (item: { label: string; section: string; priceEuro?: number | null }) => void
  onRemoveItem?: (id: string) => void
}

export function ShoppingListSection({
  items,
  partyDetails,
  editable = false,
  generating = false,
  errorMessage = null,
  selectedIdeasCount = 0,
  onGenerate,
  onToggleItem,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const miscSection = t('shopping.section.misc')
  const [section, setSection] = useState(miscSection)
  const [price, setPrice] = useState('')

  const DEFAULT_SECTIONS = [
    t('shopping.section.deco'),
    t('shopping.section.food'),
    t('shopping.section.drinks'),
    t('shopping.section.tableware'),
    t('shopping.section.baking'),
    t('shopping.section.partyFavours'),
    t('shopping.section.games'),
    t('shopping.section.entertainment'),
    t('shopping.section.invitation'),
    t('shopping.section.schedule'),
    t('shopping.section.shopping'),
    t('shopping.section.misc'),
  ]

  const grouped = useMemo(() => groupItems(items, miscSection), [items, miscSection])
  const canGenerate = selectedIdeasCount > 0 && typeof onGenerate === 'function'
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + (typeof item.priceEuro === 'number' ? item.priceEuro : 0), 0),
    [items]
  )
  const budgetLimit = partyDetails?.budgetLimitEuro ?? null
  const overBudget =
    typeof budgetLimit === 'number' && Number.isFinite(budgetLimit) ? totalPrice - budgetLimit : null
  const euro = useMemo(
    () =>
      new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }),
    []
  )

  function handleAdd() {
    const nextLabel = label.trim()
    const nextSection = normalizeSection(section, miscSection)
    if (!nextLabel || !onAddItem) return
    const normalizedPrice = price.trim().replace(',', '.')
    onAddItem({
      label: nextLabel,
      section: nextSection,
      priceEuro: normalizedPrice ? (Number.isFinite(Number.parseFloat(normalizedPrice)) ? Number.parseFloat(normalizedPrice) : null) : null,
    })
    setLabel('')
    setSection(nextSection)
    setPrice('')
  }

  return (
    <section className="rounded-[1.75rem] border border-orange-100 bg-white/85 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] print:rounded-none print:border print:border-stone-300 print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 print:text-stone-500">
            {t('shopping.title')}
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 print:text-black">
            {t('shopping.subtitle')}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 print:text-stone-700">
            {t('shopping.description')}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 print:border print:border-stone-300 print:bg-white print:text-black">
              {t('shopping.estimatedCosts', { cost: euro.format(totalPrice) })}
            </span>
            {budgetLimit !== null && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 print:border print:border-stone-300 print:bg-white print:text-black">
                {t('shopping.budget', { budget: euro.format(budgetLimit) })}
              </span>
            )}
          </div>
          {overBudget !== null && overBudget > 0 && (
            <p className="mt-2 text-sm font-medium text-amber-700 print:text-stone-700">
              {t('shopping.overBudget', { value: euro.format(overBudget) })}
            </p>
          )}
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={onGenerate}
              disabled={!canGenerate || generating}
              className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600 disabled:opacity-40"
            >
              {generating ? t('shopping.generating') : items.length > 0 ? t('shopping.update') : t('shopping.generate')}
            </button>
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-4 rounded-[1.35rem] border border-amber-100 bg-amber-50/60 p-4 print:hidden">
          {errorMessage && (
            <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
              <p className="font-semibold">{errorMessage}</p>
              <p className="mt-1 text-rose-600">{t('shopping.fallbackHint')}</p>
            </div>
          )}
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[1fr_180px_140px]">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('shopping.addPlaceholder')}
              className="flex-1 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100 lg:max-w-52"
            >
              {DEFAULT_SECTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder={t('shopping.pricePlaceholder')}
              className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <button
              onClick={handleAdd}
              disabled={!label.trim()}
              className="rounded-2xl bg-stone-800 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-40"
            >
              {t('shopping.add')}
            </button>
          </div>
          {selectedIdeasCount === 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {t('shopping.selectedHint')}
            </p>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center text-sm text-stone-500 print:border-stone-300 print:bg-white print:text-stone-700">
          {t('shopping.noList')}
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
                  {t('shopping.sectionCount', { count: sectionItems.length })}
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
                        aria-label={item.checked ? t('shopping.markNotBought') : t('shopping.markBought')}
                        title={item.checked ? t('shopping.markNotBought') : t('shopping.markBought')}
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
                      {typeof item.priceEuro === 'number' && Number.isFinite(item.priceEuro) && (
                        <p className="mt-1 text-sm font-medium text-amber-700 print:text-stone-700">
                          ca. {euro.format(item.priceEuro)}
                        </p>
                      )}
                    </div>

                    {editable && onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="rounded-full px-2 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 print:hidden"
                      >
                        {t('shopping.remove')}
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
