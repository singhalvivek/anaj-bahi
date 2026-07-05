'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { Bill, StoredGrainLine } from '@/lib/db/repo'
import type { BusinessProfile } from '@/lib/settings/profile'
import { computeGrainLine, computeBillTotal } from '@/lib/calc'
import { formatRupees, formatDate } from '@/components/format'

/**
 * Bilingual, phone-legible receipt. FROZEN prop shape so the integrator can
 * capture the root node (`data-testid="receipt"`, forwarded ref) with
 * html-to-image. Deliberately styled with INLINE hex colours (not Tailwind
 * colour classes) so the rasterised PNG never inherits an `oklch()` computed
 * colour that some html-to-image / headless-Chromium paths choke on — the
 * capture stays clean and deterministic.
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

const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(function Receipt(
  { bill, profile, farmerPhone, grainName },
  ref,
) {
  const { t } = useI18n()
  const nameOf = (id: string): string => (grainName ? grainName(id) : id)
  const kg = t('receipt.kg')
  const billTotal = computeBillTotal(bill.lines)

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '13px',
    lineHeight: 1.5,
  }
  const labelStyle: React.CSSProperties = { color: COLORS.faint }
  const valueStyle: React.CSSProperties = { color: COLORS.text, fontWeight: 500, textAlign: 'right' }

  return (
    <div
      ref={ref}
      data-testid="receipt"
      style={{
        width: '380px',
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
        <div style={rowStyle}>
          <span style={labelStyle}>{t('receipt.billNo')}</span>
          <span style={valueStyle}>{bill.id}</span>
        </div>
        <div style={rowStyle}>
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

      {/* Grain lines — full sack-by-sack breakdown per line */}
      {bill.lines.map((line: StoredGrainLine, li: number) => {
        const totals = computeGrainLine(line)
        return (
          <div
            key={line.id ?? li}
            style={{ padding: '12px 0', borderBottom: `1px solid ${COLORS.line}` }}
          >
            <div style={{ ...rowStyle, marginBottom: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: COLORS.text }}>
                {nameOf(line.grainTypeId)}
              </span>
              <span style={{ fontSize: '12px', color: COLORS.muted, textAlign: 'right' }}>
                {formatRupees(line.pricePerQuintal)} / {t('receipt.perQuintal')}
              </span>
            </div>

            {/* Every sack weight, in entry order */}
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: COLORS.faint, marginBottom: '2px' }}>
                {t('receipt.sacks')}
              </div>
              {line.sackWeights.map((w, si) => (
                <div key={si} data-testid="receipt-sack" style={rowStyle}>
                  <span style={labelStyle}>#{si + 1}</span>
                  <span style={valueStyle}>
                    {w} {kg}
                  </span>
                </div>
              ))}
            </div>

            {/* Deductions */}
            {line.deductions.length > 0 ? (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', color: COLORS.faint, marginBottom: '2px' }}>
                  {t('receipt.deduction')}
                </div>
                {line.deductions.map((d, di) => (
                  <div key={di} style={rowStyle}>
                    <span style={labelStyle}>{t(`deduction.basis.${d.basis}`)}</span>
                    <span style={valueStyle}>{d.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Line totals */}
            <div style={rowStyle}>
              <span style={labelStyle}>{t('receipt.gross')}</span>
              <span style={valueStyle}>
                {totals.grossWeightKg} {kg}
              </span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('receipt.net')}</span>
              <span style={valueStyle}>
                {totals.netWeightKg} {kg}
              </span>
            </div>
            <div style={{ ...rowStyle, marginTop: '2px' }}>
              <span style={{ ...labelStyle, color: COLORS.muted, fontWeight: 600 }}>
                {t('receipt.amount')}
              </span>
              <span style={{ ...valueStyle, color: COLORS.accent, fontWeight: 700 }}>
                {formatRupees(totals.amount)}
              </span>
            </div>
          </div>
        )
      })}

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
