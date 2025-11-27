import React from 'react'

type Props = { label: string; value: number; sign?: '+' | '-' }

export function SummaryRow({ label, value, sign }: Props) {
  return (
    <div className="summary-row">
      <span className="summary-label">
        {label}
        {sign ? ` (${sign})` : ''}
      </span>
      <span className="summary-value">{value.toLocaleString()}円</span>
    </div>
  )
}
