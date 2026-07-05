'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import {
  ensureSeeded,
  listGrainTypes,
  addCustomGrainType,
  upsertFarmer,
  createBill,
  updateBill,
  getBill,
  getFarmer,
  BillLockedError,
  type GrainType,
  type StoredGrainLine,
  type Bill,
} from '@/lib/db/repo'
import { generateBillId } from '@/lib/db/id'
import {
  computeGrainLine,
  computeBillTotal,
  type DeductionBasis,
  type GrainLineInput,
} from '@/lib/calc'
import { FarmerPicker } from '@/components/bill-form/FarmerPicker'
import { GrainLineEditor } from '@/components/bill-form/GrainLineEditor'
import { LiveTotals } from '@/components/bill-form/LiveTotals'

// ---- Draft (editor) types shared with the child components ----

export interface DeductionDraft {
  basis: DeductionBasis
  value: string // controlled numeric input; parsed for calc
}

export interface GrainLineDraft {
  key: string
  id?: string // stored line id — preserved across an edit (undefined → new line)
  grainTypeId: string
  price: string // controlled numeric input; parsed for calc
  sackWeights: number[]
  deductions: DeductionDraft[]
}

export interface FarmerValue {
  id?: string // present → existing farmer; absent → new farmer to create at save
  name: string
  place: string
  phone?: string
}

// ---- helpers ----

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function draftToInput(line: GrainLineDraft): GrainLineInput {
  return {
    pricePerQuintal: Number(line.price) || 0,
    sackWeights: line.sackWeights,
    deductions: line.deductions.map((d) => ({
      basis: d.basis,
      value: Number(d.value) || 0,
    })),
  }
}

function newLineDraft(grainTypeId: string): GrainLineDraft {
  return {
    key: crypto.randomUUID(),
    grainTypeId,
    price: '',
    sackWeights: [],
    deductions: [],
  }
}

/** Stored grain line → editor draft, preserving line id, sack order and deduction order. */
function storedLineToDraft(line: StoredGrainLine): GrainLineDraft {
  return {
    key: crypto.randomUUID(),
    id: line.id,
    grainTypeId: line.grainTypeId,
    price: String(line.pricePerQuintal),
    sackWeights: [...line.sackWeights], // preserve entry order exactly
    deductions: line.deductions.map((d) => ({ basis: d.basis, value: String(d.value) })),
  }
}

// ---- screen ----

function NewBillForm() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit') ?? '' // Next already decodes query params.
  const isEdit = editId !== ''

  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [lockError, setLockError] = useState(false)
  const [saving, setSaving] = useState(false)

  const [grainTypes, setGrainTypes] = useState<GrainType[]>([])
  const [original, setOriginal] = useState<Bill | null>(null) // loaded bill in edit mode
  const [farmer, setFarmer] = useState<FarmerValue | null>(null)
  const [purchaseDate, setPurchaseDate] = useState<string>(todayIso())
  const [dueDate, setDueDate] = useState<string>('')
  const [billId, setBillId] = useState<string>('')
  const [lines, setLines] = useState<GrainLineDraft[]>([newLineDraft('')])

  // Seed + load grain types on mount; in edit mode also load and pre-fill the bill.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureSeeded()
        const types = await listGrainTypes()
        if (cancelled) return
        setGrainTypes(types)

        if (isEdit) {
          const bill = await getBill(editId)
          if (cancelled) return
          if (bill) {
            setOriginal(bill)
            const f = await getFarmer(bill.farmerId)
            if (cancelled) return
            setFarmer({
              id: bill.farmerId,
              name: bill.farmerName,
              place: bill.farmerPlace,
              phone: f?.phone,
            })
            setPurchaseDate(bill.purchaseDate)
            setDueDate(bill.dueDate ?? '')
            setBillId(bill.id)
            setLines(bill.lines.map(storedLineToDraft))
          }
        } else {
          // Default any empty grain line to the first available type.
          setLines((prev) =>
            prev.map((l) => (l.grainTypeId ? l : { ...l, grainTypeId: types[0]?.id ?? '' })),
          )
        }
      } catch {
        if (!cancelled) setStorageError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // editId/isEdit are route-derived and stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preview a bill id for the chosen date (finalised/re-verified on save).
  // In edit mode the id is immutable — keep the loaded id, never regenerate.
  useEffect(() => {
    if (isEdit) return
    let cancelled = false
    ;(async () => {
      try {
        const id = await generateBillId(
          isoToLocalDate(purchaseDate),
          async (candidate) => !!(await getBill(candidate)),
        )
        if (!cancelled) setBillId(id)
      } catch {
        /* id preview is best-effort; save will regenerate if needed */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [purchaseDate, isEdit])

  // Live math — recomputed on every change via the pure calc module only.
  const lineTotals = useMemo(
    () => lines.map((l) => computeGrainLine(draftToInput(l))),
    [lines],
  )
  const billTotal = useMemo(
    () => computeBillTotal(lines.map(draftToInput)),
    [lines],
  )

  // ---- validation ----
  const farmerReady = !!farmer && !!farmer.name.trim() && !!farmer.place.trim()
  const linesReady =
    lines.length >= 1 &&
    lines.every(
      (l) => l.sackWeights.length >= 1 && (Number(l.price) || 0) > 0,
    )
  const valid = farmerReady && linesReady

  let hint = ''
  if (!farmerReady) hint = t('validation.farmerRequired')
  else if (lines.length < 1) hint = t('validation.lineRequired')
  else if (lines.some((l) => l.sackWeights.length < 1))
    hint = t('validation.sackRequired')
  else if (lines.some((l) => (Number(l.price) || 0) <= 0))
    hint = t('validation.priceRequired')

  // ---- line mutations ----
  function updateLine(index: number, next: GrainLineDraft) {
    setLines((prev) => prev.map((l, i) => (i === index ? next : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, newLineDraft(grainTypes[0]?.id ?? '')])
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }
  async function addCustomGrain(nameEn: string, nameHi: string): Promise<GrainType> {
    const created = await addCustomGrainType(nameEn, nameHi)
    setGrainTypes((prev) => [...prev, created])
    return created
  }

  // ---- save ----
  async function handleSave() {
    if (!valid || saving || !farmer) return
    setSaving(true)
    setSaveError(false)
    setLockError(false)
    try {
      // Resolve the farmer (create if new).
      let farmerId: string
      let farmerName: string
      let farmerPlace: string
      if (farmer.id) {
        farmerId = farmer.id
        farmerName = farmer.name.trim()
        farmerPlace = farmer.place.trim()
      } else {
        const created = await upsertFarmer({
          name: farmer.name.trim(),
          place: farmer.place.trim(),
          phone: farmer.phone?.trim() || undefined,
        })
        farmerId = created.id
        farmerName = created.name
        farmerPlace = created.place
      }

      // Preserve line id / sack order / deduction order across an edit; new lines get a fresh id.
      const storedLines: StoredGrainLine[] = lines.map((l) => ({
        id: l.id ?? crypto.randomUUID(),
        grainTypeId: l.grainTypeId,
        pricePerQuintal: Number(l.price) || 0,
        sackWeights: l.sackWeights, // preserve entry order exactly
        deductions: l.deductions.map((d) => ({
          basis: d.basis,
          value: Number(d.value) || 0,
        })),
      }))

      const grainTypeIds = Array.from(
        new Set(storedLines.map((l) => l.grainTypeId).filter(Boolean)),
      )

      if (isEdit && original) {
        // Edit an existing bill — keep the same id, createdAt and payments;
        // updateBill throws BillLockedError if a payment slipped in meanwhile.
        const updated: Bill = {
          ...original,
          farmerId,
          farmerName,
          farmerPlace,
          purchaseDate,
          dueDate: dueDate || undefined,
          grainTypeIds,
          lines: storedLines,
        }
        await updateBill(updated)
        router.push(`/bill?id=${encodeURIComponent(original.id)}`)
        return
      }

      // Create — finalise the bill id (reuse the preview unless it now collides).
      let id = billId
      if (!id || (await getBill(id))) {
        id = await generateBillId(
          isoToLocalDate(purchaseDate),
          async (candidate) => !!(await getBill(candidate)),
        )
      }

      await createBill({
        id,
        farmerId,
        farmerName,
        farmerPlace,
        purchaseDate,
        dueDate: dueDate || undefined,
        grainTypeIds,
        lines: storedLines,
        payments: [],
      })

      router.push('/')
    } catch (err) {
      if (err instanceof BillLockedError) {
        setLockError(true)
      } else {
        setSaveError(true)
      }
      setSaving(false)
    }
  }

  // ---- render ----

  if (storageError) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">
          {t('error.storage')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Sub-header: back link + screen title (global TopBar/toggle live in the layout) */}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <Link
          href="/"
          className="flex h-11 min-w-11 items-center text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← {t('action.back')}
        </Link>
        <h2 className="text-lg font-bold text-stone-900">
          {isEdit ? t('action.edit') : t('newbill.title')}
        </h2>
      </div>

      <div className="space-y-4 p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-14 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
          </div>
        ) : (
          <>
            {/* Farmer */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <FarmerPicker value={farmer} onChange={setFarmer} />
            </section>

            {/* Purchase date + due date + bill id preview */}
            <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <label className="text-sm font-medium text-gray-700">
                {t('purchaseDate.label')}
              </label>
              <input
                data-testid="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none"
              />

              <label className="text-sm font-medium text-gray-700">{t('dueDate.label')}</label>
              <input
                data-testid="due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none"
              />

              {billId && (
                <p className="text-sm text-gray-500">
                  {t('billId.label')}: <span className="font-mono">{billId}</span>
                </p>
              )}
            </section>

            {/* Grain lines */}
            {lines.map((line, i) => (
              <GrainLineEditor
                key={line.key}
                index={i}
                line={line}
                grainTypes={grainTypes}
                totals={lineTotals[i]}
                canRemove={lines.length > 1}
                onChange={(next) => updateLine(i, next)}
                onRemove={() => removeLine(i)}
                onAddCustomGrain={addCustomGrain}
              />
            ))}

            <button
              type="button"
              onClick={addLine}
              className="h-12 w-full rounded-lg border border-dashed border-emerald-400 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              {t('grain.addAnother')}
            </button>

            {saveError && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {t('error.generic')}
              </p>
            )}
            {lockError && (
              <p
                data-testid="edit-locked"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              >
                🔒 {t('lock.locked')}
              </p>
            )}
          </>
        )}
      </div>

      {/* Sticky footer: live total + save. Sits above the fixed global BottomNav. */}
      {!loading && (
        <footer className="sticky bottom-16 z-10 mt-2 space-y-2 border-t border-stone-200 bg-white p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <LiveTotals billTotal={billTotal} />
          {!valid && hint && (
            <p className="text-center text-sm text-amber-700">{hint}</p>
          )}
          <button
            type="button"
            data-testid="save-bill"
            onClick={handleSave}
            disabled={!valid || saving}
            className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('action.saving') : t('action.save')}
          </button>
        </footer>
      )}
    </div>
  )
}

export default function NewBillPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <div className="h-14 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
        </div>
      }
    >
      <NewBillForm />
    </Suspense>
  )
}
