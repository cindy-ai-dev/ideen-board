import { useMemo } from 'react'
import { useBoard } from '../lib/storage'
import { getConfirmedGuestTotal } from '../lib/prompts'
import { formatPartyScheduleLabel, sortPartySchedule } from '../lib/schedule'
import { categoryColor } from './TileCard'
import { ShoppingListSection } from './ShoppingListSection'
import { TaskTimelineSection } from './TaskTimelineSection'

function formatPartyDate(date: string, time: string): string {
  if (!date) return 'Ohne Datum'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  const datePart = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
  return time ? `${datePart}, ${time} Uhr` : datePart
}

function statusLabel(status: 'eingeladen' | 'zugesagt' | 'abgesagt'): string {
  if (status === 'zugesagt') return 'Zugesagt'
  if (status === 'abgesagt') return 'Abgesagt'
  return 'Eingeladen'
}

function guestAllergyLabel(allergies?: string): string | null {
  const value = allergies?.trim()
  return value ? value : null
}

export function BoardPlanView({
  boardId,
  onBack,
  onPrint,
}: {
  boardId: string
  onBack: () => void
  onPrint?: () => void
}) {
  const [board] = useBoard(boardId)

  const selectedByCategory = useMemo(() => {
    const map = new Map<string, typeof board.tiles>()
    for (const tile of board.tiles.filter((tile) => tile.selected)) {
      const list = map.get(tile.category) ?? []
      list.push(tile)
      map.set(tile.category, list)
    }
    return map
  }, [board.tiles])

  const hasSelectedIdeas = selectedByCategory.size > 0
  const confirmedGuestTotal = getConfirmedGuestTotal(board.partyDetails)
  const guestCountLabel =
    confirmedGuestTotal > 0
      ? `${confirmedGuestTotal} Person${confirmedGuestTotal === 1 ? '' : 'en'}`
      : typeof board.partyDetails.guestCount === 'number'
        ? `${board.partyDetails.guestCount}`
        : '–'
  const ageLabel =
    typeof board.partyDetails.age === 'number' && board.partyDetails.age > 0
      ? `${Math.round(board.partyDetails.age)} Jahre`
      : null
  const preferencesLabel = board.partyDetails.preferences.trim() || null
  const totalShoppingPrice = board.shoppingList.reduce(
    (sum, item) => sum + (typeof item.priceEuro === 'number' ? item.priceEuro : 0),
    0
  )
  const planningTaskCount = board.planningTasks.length
  const budgetLimit = board.partyDetails.budgetLimitEuro
  const euro = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  })
  const costText =
    euro.format(totalShoppingPrice)
  const budgetText =
    typeof budgetLimit === 'number' && Number.isFinite(budgetLimit)
      ? `${costText} · Budget ${euro.format(budgetLimit)}`
      : costText
  const sortedSchedule = useMemo(() => sortPartySchedule(board.partySchedule), [board.partySchedule])

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={onBack}
          className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
        >
          ← Zurück zum Board
        </button>
        <button
          onClick={onPrint ?? (() => window.print())}
          className="rounded-2xl bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700"
        >
          Drucken / PDF
        </button>
      </div>

      <section className="rounded-[1.85rem] border border-orange-100 bg-white/85 p-6 shadow-[0_12px_35px_rgba(119,75,43,0.08)] print:rounded-none print:border print:border-stone-300 print:bg-white print:p-0 print:shadow-none">
        <div className="border-b border-orange-100 px-0 pb-5 print:border-stone-300">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 print:text-stone-500">
            Gesamtplan
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-800 print:text-black">
            {board.partyDetails.forWhom || board.topic || 'Party'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-500 print:text-stone-700">
            Druckfreundliche Übersicht mit den Party-Details, der Gästeliste und allen
            ausgewählten Ideen.
          </p>
        </div>

        <div className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-3">
          <InfoCard label="Anlass / Für wen" value={board.partyDetails.forWhom || 'Nicht gesetzt'} />
          <InfoCard label="Motto" value={board.partyDetails.theme || 'Keins gesetzt'} />
          {ageLabel && <InfoCard label="Alter" value={ageLabel} />}
          <InfoCard label="Ort" value={board.partyDetails.location || 'Nicht gesetzt'} />
          <InfoCard label="Datum" value={formatPartyDate(board.partyDetails.date, board.partyDetails.time)} />
          <InfoCard label="Uhrzeit" value={board.partyDetails.time || 'Nicht gesetzt'} />
          <InfoCard
            label="Gästezahl"
            value={
              confirmedGuestTotal > 0 && typeof board.partyDetails.guestCount === 'number'
                ? `${guestCountLabel} · geplant ${board.partyDetails.guestCount}`
                : guestCountLabel
            }
          />
          <InfoCard label="Zeitplan-Aufgaben" value={`${planningTaskCount}`} />
          <InfoCard label="Einkaufskosten" value={budgetText} />
          {preferencesLabel && (
            <div className="sm:col-span-2 lg:col-span-3">
              <InfoCard label="Vorlieben / Besonderheiten" value={preferencesLabel} />
            </div>
          )}
        </div>

        <div className="grid gap-6 border-t border-orange-100 pt-5 lg:grid-cols-[1.2fr_0.8fr] print:grid-cols-2 print:border-stone-300">
          <section className="rounded-[1.35rem] border border-orange-100 bg-orange-50/50 p-4 print:rounded-none print:border-stone-300 print:bg-white">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-orange-600 print:text-black">
              Gästeliste
            </h2>
            {board.partyDetails.guests.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">Noch keine Gäste eingetragen.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {board.partyDetails.guests.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex flex-col gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-2.5 print:border-stone-200 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-stone-800">
                        {guest.name}
                      </span>
                      {guestAllergyLabel(guest.allergies) && (
                        <p className="mt-1 text-xs leading-relaxed text-stone-500 print:text-stone-700">
                          Allergien / Unverträglichkeiten: {guestAllergyLabel(guest.allergies)}
                        </p>
                      )}
                    </div>
                    <span className="self-start rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 print:border print:border-stone-300 print:bg-white">
                      {statusLabel(guest.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-5 rounded-[1.35rem] border border-orange-100 bg-orange-50/50 p-4 print:rounded-none print:border-stone-300 print:bg-white">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-orange-600 print:text-black">
            Ablaufplan
          </h2>
          {sortedSchedule.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500 print:text-stone-700">
              Noch kein Ablaufplan generiert.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {sortedSchedule.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-2.5 print:border-stone-200 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-800">{item.title}</span>
                    {item.note && (
                      <p className="mt-1 text-xs leading-relaxed text-stone-500 print:text-stone-700">
                        {item.note}
                      </p>
                    )}
                  </div>
                  <span className="self-start rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 print:border print:border-stone-300 print:bg-white">
                    {formatPartyScheduleLabel(item, board.partyDetails)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-orange-100 pt-5 print:border-stone-300">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-orange-600 print:text-black">
                Ausgewählte Ideen
              </h2>
              <p className="mt-1 text-sm text-stone-500 print:text-stone-700">
                Nur die als ausgewählt markierten Kacheln, nach Kategorie gruppiert.
              </p>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 print:border print:border-stone-300 print:bg-white print:text-stone-700">
              {board.tiles.filter((tile) => tile.selected).length} ausgewählt
            </span>
          </div>

          {hasSelectedIdeas ? (
            <div className="mt-4 space-y-4">
              {[...selectedByCategory.entries()].map(([category, tiles]) => {
                const color = categoryColor(category)
                return (
                  <section
                    key={category}
                    className="rounded-[1.35rem] border border-orange-100 bg-white p-4 print:rounded-none print:border-stone-300 print:break-inside-avoid"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3
                        className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] ${color.bg} ${color.text} print:bg-white print:text-black print:border print:border-stone-300`}
                      >
                        {category}
                      </h3>
                      <span className="text-xs font-semibold text-stone-500 print:text-stone-700">
                        {tiles.length} Idee{tiles.length === 1 ? '' : 'n'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      {tiles.map((tile) => (
                        <article
                          key={tile.id}
                          className="rounded-2xl border border-orange-100 bg-orange-50/50 p-3 print:border-stone-200 print:bg-white print:break-inside-avoid"
                        >
                          <h4 className="font-semibold text-stone-800 print:text-black">{tile.title}</h4>
                          {tile.description && (
                            <p className="mt-1 text-sm leading-relaxed text-stone-600 print:text-stone-800">
                              {tile.description}
                            </p>
                          )}
                          {tile.url && (
                            <p className="mt-2 break-all text-xs text-stone-500 print:text-stone-700">
                              {tile.url}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 px-4 py-8 text-center text-sm text-stone-500 print:border-stone-300 print:bg-white print:text-stone-700">
              Noch keine ausgewählten Ideen markiert.
            </p>
          )}
        </section>

        <section className="border-t border-orange-100 pt-5 print:border-stone-300">
          <TaskTimelineSection items={board.planningTasks} partyDetails={board.partyDetails} />
        </section>

        <div className="border-t border-orange-100 pt-5 print:border-stone-300">
          <ShoppingListSection
            items={board.shoppingList}
            partyDetails={board.partyDetails}
            selectedIdeasCount={board.tiles.filter((tile) => tile.selected).length}
          />
        </div>
      </section>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-orange-100 bg-orange-50/60 p-4 print:rounded-none print:border-stone-300 print:bg-white">
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500 print:text-stone-500">
        {label}
      </dt>
      <dd className="mt-2 text-base font-semibold leading-snug text-stone-800 print:text-black">
        {value}
      </dd>
    </div>
  )
}
