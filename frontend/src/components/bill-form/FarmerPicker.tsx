'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { searchFarmers, type Farmer } from '@/lib/db/repo'
import { PhoneField } from '@/components/PhoneField'
import type { FarmerValue } from '@/app/bills/new/page'

interface FarmerPickerProps {
  value: FarmerValue | null
  onChange: (value: FarmerValue | null) => void
}

/**
 * Farmer text input with prefix autocomplete against saved farmers.
 * - Selecting a suggestion reuses that farmer (fills id + place + phone).
 * - Otherwise the typed name + place (+ optional phone) become a NEW farmer,
 *   created at save time by the parent via repo.upsertFarmer.
 */
export function FarmerPicker({ value, onChange }: FarmerPickerProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState(value?.name ?? '')
  const [place, setPlace] = useState(value?.place ?? '')
  const [phone, setPhone] = useState(value?.phone ?? '')
  const [selectedId, setSelectedId] = useState<string | undefined>(value?.id)
  const [suggestions, setSuggestions] = useState<Farmer[]>([])
  const [open, setOpen] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Run the prefix search whenever the typed name changes (and we are not
  // showing an already-selected farmer). Cancels stale async results.
  useEffect(() => {
    if (selectedId) {
      setSuggestions([])
      return
    }
    const prefix = query.trim()
    if (prefix === '') {
      setSuggestions([])
      return
    }
    let cancelled = false
    searchFarmers(prefix)
      .then((rows) => {
        if (!cancelled) setSuggestions(rows)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
    return () => {
      cancelled = true
    }
  }, [query, selectedId])

  // Report the resolved farmer selection upward on every relevant change.
  useEffect(() => {
    if (selectedId) {
      onChangeRef.current({
        id: selectedId,
        name: query.trim(),
        place: place.trim(),
        phone: phone.trim() || undefined,
      })
    } else if (query.trim() && place.trim()) {
      onChangeRef.current({
        name: query.trim(),
        place: place.trim(),
        phone: phone.trim() || undefined,
      })
    } else {
      onChangeRef.current(null)
    }
  }, [query, place, phone, selectedId])

  function handleTyping(next: string) {
    setQuery(next)
    // Editing the name breaks any prior selection → treat as a new farmer.
    setSelectedId(undefined)
    setOpen(true)
  }

  function selectFarmer(f: Farmer) {
    setQuery(f.name)
    setPlace(f.place)
    setPhone(f.phone ?? '')
    setSelectedId(f.id)
    setOpen(false)
  }

  const isNew = !selectedId

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{t('farmer.label')}</label>

      <div className="relative">
        <input
          data-testid="farmer-input"
          type="text"
          value={query}
          onChange={(e) => handleTyping(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={t('farmer.searchHint')}
          autoComplete="off"
          // Soft-keyboard chain: Name → Place → Mobile (Mobile ends with Done).
          enterKeyHint="next"
          className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {suggestions.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  data-testid="farmer-suggestion"
                  onClick={() => selectFarmer(f)}
                  className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-emerald-50"
                >
                  <span className="font-medium text-gray-900">{f.name}</span>
                  <span className="text-sm text-gray-500">{f.place}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId && (
        <p className="text-sm text-emerald-700">
          {query} — {place}
        </p>
      )}

      {/* Place + phone: required (place) for a new farmer; shown filled when a
          saved farmer is selected. */}
      <input
        type="text"
        value={place}
        onChange={(e) => setPlace(e.target.value)}
        placeholder={t('farmer.place')}
        aria-label={t('farmer.place')}
        enterKeyHint="next"
        className="h-12 w-full rounded-lg border border-gray-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
      />
      <PhoneField
        value={phone}
        onChange={setPhone}
        ariaLabel={t('farmer.phone')}
        placeholder={t('farmer.phone')}
        // Last field in the farmer block — Done closes the keyboard so it never
        // jumps into the (independent) date pickers.
        enterKeyHint="done"
        className="h-12 rounded-lg border border-gray-300 text-base focus-within:border-emerald-500"
      />

      {isNew && query.trim() && (
        <p className="text-xs text-gray-500">{t('farmer.new')}</p>
      )}
    </div>
  )
}
