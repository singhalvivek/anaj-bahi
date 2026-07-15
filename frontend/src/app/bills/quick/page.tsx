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
import type { GrainLineSummary } from '@/lib/db/schema'
import { generateBillId } from '@/lib/db/id'
import {
  computeGrainLine,
  computeBillTotal,
  roundRupees,
  type GrainLineInput,
} from '@/lib/calc'
import type { FarmerValue } from '@/app/bills/new/page'
import { FarmerPicker } from '@/components/bill-form/FarmerPicker'
import { QuickGrainLineEditor } from '@/components/bill-form/QuickGrainLineEditor'
import { LiveTotals } from '@/components/bill-form/LiveTotals'
import PostSaveSharePrompt from '@/components/receipt/PostSaveSharePrompt'

// ---- Draft (editor) type for a summary grain line ----

export interface QuickGrainLineDraft {
  key: string
  id?: string // stored line id — preserved across an edit (undefined → new line)
  grainTypeId: string
  price: string // controlled numeric input; parsed for calc
  totalWeight: string // gross kg, one number
  amount: string // ₹ — auto-computed from (weight − deduction)/100 × price, but editable
  sackCount: string // optional integer; '' → omitted
  deductionKg: string // optional single total-kg deduction; '' → omitted
  amountTouched: boolean // Phase 10 — true once the user edits amount by hand → stop auto-recomputing
}

// ---- helpers ----

/** Keep digits and at most one decimal point; strip everything else. */
function sanitizeDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

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

/** Draft → calc input: a summary line carries `summary` with empty sacks/deductions. */
function draftToInput(line: QuickGrainLineDraft): GrainLineInput {
  return {
    pricePerQuintal: Number(line.price) || 0,
    sackWeights: [],
    deductions: [],
    summary: {
      totalWeightKg: Number(line.totalWeight) || 0,
      sackCount: line.sackCount.trim() ? Number(line.sackCount) : undefined,
      deductionKg: line.deductionKg.trim() ? Number(line.deductionKg) : undefined,
      amount: Number(line.amount) || 0,
    },
  }
}

function newLineDraft(grainTypeId: string): QuickGrainLineDraft {
  return {
    key: crypto.randomUUID(),
    grainTypeId,
    price: '',
    totalWeight: '',
    amount: '',
    sackCount: '',
    deductionKg: '',
    amountTouched: false, // fresh line → amount auto-computes until the user edits it
  }
}

/** Stored summary grain line → editor draft, preserving line id and blanks. */
function storedLineToDraft(line: StoredGrainLine): QuickGrainLineDraft {
  const s = line.summary
  return {
    key: crypto.randomUUID(),
    id: line.id,
    grainTypeId: line.grainTypeId,
    price: String(line.pricePerQuintal),
    totalWeight: s ? String(s.totalWeightKg) : '',
    amount: s ? String(s.amount) : '',
    sackCount: s?.sackCount != null ? String(s.sackCount) : '',
    deductionKg: s?.deductionKg != null ? String(s.deductionKg) : '',
    amountTouched: true, // a stored amount is authoritative — never auto-overwrite it on edit
  }
}

// ---- screen ----

function QuickBillForm() {
  const { t, lang } = useI18n()
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
  const [lines, setLines] = useState<QuickGrainLineDraft[]>([newLineDraft('')])
  const [paldari, setPaldari] = useState('') // Phase 10 — bill-level labor charge (₹)
  const [savedBill, setSavedBill] = useState<Bill | null>(null) // Phase 11 — post-save share prompt

  // Resolve a grain-type id to its name in the current language (mirrors the detail
  // page); feeds the post-save receipt preview. Falls back to the raw id (never blank).
  const grainName = (gid: string): string => {
    const g = grainTypes.find((gt) => gt.id === gid)
    if (!g) return gid
    return lang === 'hi' ? g.nameHi : g.nameEn
  }

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
            setPaldari(bill.paldari != null ? String(bill.paldari) : '')
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

  // Live math — summary-aware calc; each line's amount is the entered figure.
  const lineTotals = useMemo(
    () => lines.map((l) => computeGrainLine(draftToInput(l))),
    [lines],
  )
  const linesTotal = useMemo(
    () => computeBillTotal(lines.map(draftToInput)),
    [lines],
  )
  const paldariNum = Number(paldari) || 0
  const netTotal = roundRupees(linesTotal - paldariNum)

  // ---- validation ----
  const farmerReady = !!farmer && !!farmer.name.trim() && !!farmer.place.trim()
  const dateReady = !!purchaseDate
  const linesReady =
    lines.length >= 1 &&
    lines.every(
      (l) =>
        !!l.grainTypeId &&
        (Number(l.price) || 0) > 0 &&
        (Number(l.totalWeight) || 0) > 0 &&
        (Number(l.amount) || 0) > 0,
    )
  const valid = farmerReady && dateReady && linesReady

  let hint = ''
  if (!farmerReady) hint = t('validation.farmerRequired')
  else if (lines.length < 1 || lines.some((l) => !l.grainTypeId))
    hint = t('validation.lineRequired')
  else if (lines.some((l) => (Number(l.price) || 0) <= 0))
    hint = t('validation.priceRequired')
  else if (lines.some((l) => (Number(l.totalWeight) || 0) <= 0))
    hint = t('validation.totalWeightRequired')
  else if (lines.some((l) => (Number(l.amount) || 0) <= 0))
    hint = t('validation.amountRequired')

  // ---- line mutations ----
  function updateLine(index: number, next: QuickGrainLineDraft) {
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

      // Assemble summary grain lines: empty sacks/deductions + a `summary` sub-object.
      // Omit sackCount/deductionKg when left blank — never store 0 for a blank.
      const storedLines: StoredGrainLine[] = lines.map((l) => {
        const summary: GrainLineSummary = {
          totalWeightKg: Number(l.totalWeight) || 0,
          amount: Number(l.amount) || 0,
        }
        if (l.sackCount.trim()) summary.sackCount = Number(l.sackCount)
        if (l.deductionKg.trim()) summary.deductionKg = Number(l.deductionKg)
        return {
          id: l.id ?? crypto.randomUUID(),
          grainTypeId: l.grainTypeId,
          pricePerQuintal: Number(l.price) || 0,
          sackWeights: [],
          deductions: [],
          summary,
        }
      })

      const grainTypeIds = Array.from(
        new Set(storedLines.map((l) => l.grainTypeId).filter(Boolean)),
      )

      if (isEdit && original) {
        // Edit an existing summary bill — keep the same id, createdAt and payments;
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
          entryMode: 'summary',
          paldari: paldariNum > 0 ? paldariNum : undefined,
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

      const saved = await createBill({
        id,
        farmerId,
        farmerName,
        farmerPlace,
        purchaseDate,
        dueDate: dueDate || undefined,
        grainTypeIds,
        lines: storedLines,
        payments: [],
        entryMode: 'summary',
        paldari: paldariNum > 0 ? paldariNum : undefined,
      })

      // Phase 11 — offer to share the (summary) receipt right away instead of jumping
      // to the list; Done (in the prompt) navigates home. The edit branch is unchanged.
      setSavedBill(saved)
      setSaving(false)
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
          {isEdit ? t('action.edit') : t('quick.title')}
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
              <QuickGrainLineEditor
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

      {/* Footer: live total + save. Flows at the END of the form (NOT sticky/fixed),
          mirroring the fresh form; <main>'s pb-24 clears the fixed global BottomNav. */}
      {!loading && (
        <footer className="mt-2 space-y-2 border-t border-stone-200 bg-white p-4">
          {/* Paldari (labor charge) — bill-level ₹ borne by the farmer; reduces the total */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">{t('paldari.label')}</label>
            <input
              data-testid="paldari-input"
              type="text"
              inputMode="decimal"
              value={paldari}
              onChange={(e) => setPaldari(sanitizeDecimal(e.target.value))}
              placeholder={t('paldari.label')}
              className="h-14 w-full rounded-lg border border-stone-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-xs text-stone-500">{t('paldari.hint')}</p>
          </div>

          <LiveTotals billTotal={netTotal} paldari={paldariNum} />
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

      {/* Phase 11 — post-save share prompt (create success only). Done → home. */}
      {savedBill && (
        <PostSaveSharePrompt
          bill={savedBill}
          farmerPhone={farmer?.phone}
          grainName={grainName}
          onDone={() => router.push('/')}
        />
      )}
    </div>
  )
}

export default function QuickBillPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <div className="h-14 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
        </div>
      }
    >
      <QuickBillForm />
    </Suspense>
  )
}
