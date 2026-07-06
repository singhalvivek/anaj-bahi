'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { Bill, StoredGrainLine } from '@/lib/db/repo'
import type { BusinessProfile } from '@/lib/settings/profile'
import { computeGrainLine, computeBillTotal } from '@/lib/calc'
import { formatRupees, formatDate } from '@/components/format'
import { toColumns, columnSubtotals, fmtNum, deductionSummary } from './columns'

/**
 * Bilingual, paper-ledger receipt. FROZEN prop shape so the integrator can capture
 * the root node (`data-testid="receipt"`, forwarded ref) with html-to-image.
 * Deliberately styled with INLINE hex colours (not Tailwind colour classes) so the
 * rasterised PNG never inherits an `oklch()` computed colour that some
 * html-to-image / headless-Chromium paths choke on — the capture stays clean.
 *
 * Layout mirrors the trader's paper bahi: each grain's sacks are laid into COLUMNS
 * of up to 10 weights (entry order, NO sack numbers), grains flow left-to-right as
 * horizontal blocks sharing one continuous column track, and each column shows its
 * subtotal. Below the grid, a SINGLE consolidated summary table lists the grains as
 * columns and the line items (gross / deduction / net / rate / amount) as rows, so a
 * grain reads top-to-bottom. The grid is wider than a phone screen when a bill has
 * many sacks — intentional, matching the paper it replaces (max 100 sacks → 10 cols).
 *
 * `grainName` resolves a grain-type id to its name in the current language. The
 * integrator (bill detail) already has the grain-type list, so it passes the
 * resolver in; if omitted the raw id is shown (never blank).
 */
export interface ReceiptProps {
  bill: Bill
  profile: BusinessProfile
  farmerPhone?: string
  grainName?: (id: string) => string
}

const COLORS = {
  bg: '#ffffff',
  text: '#1c1917', // stone-900
  muted: '#57534e', // stone-600
  faint: '#78716c', // stone-500
  border: '#d6d3d1', // stone-300
  line: '#e7e5e4', // stone-200
  accent: '#15803d', // green-700
}

const SACKS_PER_COLUMN = 10
const CELL_W = 56 // px per weight column — fixed so the grid reads as a ledger
const ROW_H = 22 // px per weight cell

const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(function Receipt(
  { bill, profile, farmerPhone, grainName },
  ref,
) {
  const { t } = useI18n()
  const nameOf = (id: string): string => (grainName ? grainName(id) : id)
  const kg = t('receipt.kg')
  const billTotal = computeBillTotal(bill.lines)

  // Pre-compute the column layout for every grain so the whole track can share a
  // single row height — subtotal rows then align across grains (a clean ledger).
  const blocks = bill.lines.map((line: StoredGrainLine, li: number) => {
    const totals = computeGrainLine(line)
    const columns = toColumns(line.sackWeights, SACKS_PER_COLUMN)
    const subtotals = columnSubtotals(columns)
    return { line, li, totals, columns, subtotals }
  })
  const maxRows = Math.max(
    1,
    ...blocks.flatMap((b) => b.columns.map((c) => c.length)),
  )

  const metaRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '13px',
    lineHeight: 1.5,
  }
  const labelStyle: React.CSSProperties = { color: COLORS.faint }
  const valueStyle: React.CSSProperties = { color: COLORS.text, fontWeight: 500, textAlign: 'right' }

  /**
   * Deduction cell: resolved kg + a compact per-basis note, e.g. "3.595 kg (0.5/sack + 1%)".
   * The resolved kg and the basis note both come from the pure, tested `deductionSummary`
   * helper (which reuses `@/lib/calc`); the receipt only adds the language-specific kg unit
   * and the surrounding parentheses.
   */
  function deductionText(block: (typeof blocks)[number]): string {
    const { kg: deductionKg, note } = deductionSummary(block.line)
    const base = `${fmtNum(deductionKg)} ${kg}`
    return note ? `${base} (${note})` : base
  }

  // Consolidated summary — grains are COLUMNS, line items are ROWS. Read a grain
  // top-to-bottom to trace gross → deduction → net → rate → amount. Every value comes
  // from the calc engine (`blocks[*].totals`), never recomputed here.
  const thStyle: React.CSSProperties = {
    border: `1px solid ${COLORS.border}`,
    padding: '5px 8px',
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.text,
    textAlign: 'center',
    background: COLORS.line,
  }
  const rowLabelStyle: React.CSSProperties = {
    border: `1px solid ${COLORS.border}`,
    padding: '5px 8px',
    fontSize: '11px',
    color: COLORS.muted,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }
  const cellStyle: React.CSSProperties = {
    border: `1px solid ${COLORS.border}`,
    padding: '5px 8px',
    fontSize: '12px',
    color: COLORS.text,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      ref={ref}
      data-testid="receipt"
      style={{
        display: 'inline-block',
        width: 'fit-content',
        minWidth: '380px',
        boxSizing: 'border-box',
        background: COLORS.bg,
        color: COLORS.text,
        padding: '20px',
        fontFamily:
          "'Noto Sans', 'Noto Sans Devanagari', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Business header */}
      <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: `2px solid ${COLORS.text}` }}>
        <div
          data-testid="receipt-shop"
          style={{ fontSize: '20px', fontWeight: 700, color: COLORS.text }}
        >
          {profile.shopName}
        </div>
        {profile.traderName ? (
          <div style={{ fontSize: '13px', color: COLORS.muted, marginTop: '2px' }}>
            {profile.traderName}
          </div>
        ) : null}
        {profile.phone ? (
          <div style={{ fontSize: '12px', color: COLORS.faint, marginTop: '2px' }}>
            {t('receipt.phone')}: {profile.phone}
          </div>
        ) : null}
        {profile.address ? (
          <div style={{ fontSize: '12px', color: COLORS.faint, marginTop: '2px' }}>
            {profile.address}
          </div>
        ) : null}
      </div>

      {/* Bill meta */}
      <div style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.line}` }}>
        <div style={metaRowStyle}>
          <span style={labelStyle}>{t('receipt.billNo')}</span>
          <span style={valueStyle}>{bill.id}</span>
        </div>
        <div style={metaRowStyle}>
          <span style={labelStyle}>{t('receipt.date')}</span>
          <span style={valueStyle}>{formatDate(bill.purchaseDate)}</span>
        </div>
      </div>

      {/* Farmer */}
      <div style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.line}` }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: COLORS.text }}>
          {bill.farmerName}
        </div>
        {bill.farmerPlace ? (
          <div style={{ fontSize: '13px', color: COLORS.faint }}>
            {t('receipt.place')}: {bill.farmerPlace}
          </div>
        ) : null}
        {farmerPhone ? (
          <div style={{ fontSize: '13px', color: COLORS.faint }}>
            {t('receipt.phone')}: {farmerPhone}
          </div>
        ) : null}
      </div>

      {/* Sack ledger — grains as horizontal blocks over one continuous column track */}
      <div style={{ padding: '12px 0' }}>
        <div style={{ fontSize: '11px', color: COLORS.faint, marginBottom: '6px' }}>
          {t('receipt.sacks')}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {blocks.map((block) => {
            const colCount = Math.max(1, block.columns.length)
            const blockWidth = colCount * CELL_W
            return (
              <div
                key={block.line.id ?? block.li}
                data-testid="receipt-grain-block"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  borderLeft: block.li > 0 ? `2px solid ${COLORS.border}` : 'none',
                  paddingLeft: block.li > 0 ? '6px' : 0,
                  marginLeft: block.li > 0 ? '6px' : 0,
                }}
              >
                {/* Grain name — spans the whole block */}
                <div
                  style={{
                    width: `${blockWidth}px`,
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: COLORS.text,
                    padding: '2px 0 4px',
                    borderBottom: `1px solid ${COLORS.text}`,
                  }}
                >
                  {nameOf(block.line.grainTypeId)}
                </div>

                {/* Weight columns — side by side, entry order, NO numbers */}
                <div style={{ display: 'flex' }}>
                  {(block.columns.length ? block.columns : [[]]).map((col, ci) => (
                    <div
                      key={ci}
                      data-testid="receipt-column"
                      style={{
                        width: `${CELL_W}px`,
                        boxSizing: 'border-box',
                        borderRight:
                          ci < colCount - 1 ? `1px solid ${COLORS.line}` : 'none',
                      }}
                    >
                      {Array.from({ length: maxRows }).map((_, ri) => {
                        const w = col[ri]
                        return (
                          <div
                            key={ri}
                            style={{
                              height: `${ROW_H}px`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              color: COLORS.text,
                              borderBottom: `1px solid ${COLORS.line}`,
                            }}
                          >
                            {w === undefined ? (
                              <span style={{ color: COLORS.line }}>·</span>
                            ) : (
                              <span data-testid="receipt-weight">{fmtNum(w)}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>

                {/* Subtotal row — one cell under each column */}
                <div style={{ display: 'flex', borderTop: `2px solid ${COLORS.text}` }}>
                  {(block.subtotals.length ? block.subtotals : [0]).map((s, ci) => (
                    <div
                      key={ci}
                      data-testid="receipt-col-subtotal"
                      style={{
                        width: `${CELL_W}px`,
                        boxSizing: 'border-box',
                        height: `${ROW_H}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: COLORS.text,
                        borderRight:
                          ci < colCount - 1 ? `1px solid ${COLORS.line}` : 'none',
                      }}
                    >
                      {fmtNum(s)}
                    </div>
                  ))}
                </div>

              </div>
            )
          })}
        </div>
      </div>

      {/* Consolidated summary — grains as COLUMNS, line items as ROWS.
          Sized to its own content (NO inner overflow/scroll) so the whole receipt
          is a single width and html-to-image never crops a grain column off the
          PNG. The outer preview container (bill/page.tsx) owns on-screen scroll. */}
      <div style={{ padding: '0 0 4px' }}>
        <table
          data-testid="receipt-summary-table"
          style={{
            borderCollapse: 'collapse',
            width: 'max-content',
            minWidth: '100%',
            tableLayout: 'auto',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', background: COLORS.bg, border: 'none' }} />
              {blocks.map((block) => (
                <th
                  key={block.line.id ?? block.li}
                  data-testid="receipt-summary-grain"
                  style={thStyle}
                >
                  {nameOf(block.line.grainTypeId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Gross weight (kg) */}
            <tr>
              <td style={rowLabelStyle}>{t('totals.gross')}</td>
              {blocks.map((block) => (
                <td
                  key={block.line.id ?? block.li}
                  data-testid="receipt-grain-gross"
                  style={cellStyle}
                >
                  {fmtNum(block.totals.grossWeightKg)} {kg}
                </td>
              ))}
            </tr>
            {/* Deduction — resolved kg + compact basis note */}
            <tr>
              <td style={rowLabelStyle}>{t('totals.deduction')}</td>
              {blocks.map((block) => (
                <td
                  key={block.line.id ?? block.li}
                  data-testid="receipt-grain-deduction"
                  style={cellStyle}
                >
                  {deductionText(block)}
                </td>
              ))}
            </tr>
            {/* Net weight — kg only (weight is always shown in kg; the quintal
                unit appears only on the rate row, which is the trade standard). */}
            <tr>
              <td style={rowLabelStyle}>{t('totals.net')}</td>
              {blocks.map((block) => (
                <td
                  key={block.line.id ?? block.li}
                  data-testid="receipt-grain-net"
                  style={cellStyle}
                >
                  {fmtNum(block.totals.netWeightKg)} {kg}
                </td>
              ))}
            </tr>
            {/* Rate (₹ per quintal) */}
            <tr>
              <td style={rowLabelStyle}>{t('receipt.price')}</td>
              {blocks.map((block) => (
                <td key={block.line.id ?? block.li} style={cellStyle}>
                  {formatRupees(block.line.pricePerQuintal)} / {t('receipt.perQuintal')}
                </td>
              ))}
            </tr>
            {/* Amount (₹) */}
            <tr>
              <td style={{ ...rowLabelStyle, fontWeight: 700, color: COLORS.text }}>
                {t('receipt.amount')}
              </td>
              {blocks.map((block) => (
                <td
                  key={block.line.id ?? block.li}
                  data-testid="receipt-grain-amount"
                  style={{ ...cellStyle, fontWeight: 700, color: COLORS.accent }}
                >
                  {formatRupees(block.totals.amount)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bill total */}
      <div
        data-testid="receipt-total"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: COLORS.accent,
          color: '#ffffff',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600 }}>{t('receipt.total')}</span>
        <span style={{ fontSize: '20px', fontWeight: 800 }}>{formatRupees(billTotal)}</span>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: COLORS.faint }}>
        {t('receipt.thanks')}
      </div>
    </div>
  )
})

export default Receipt
