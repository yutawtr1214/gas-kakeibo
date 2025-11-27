import React from 'react'
import type { BalanceHistoryItem } from '../lib/api/types'

type ChartProps = {
  data: BalanceHistoryItem[]
  limit?: number
}

export function BalanceChart({ data, limit }: ChartProps) {
  const list = limit ? data.slice(-limit) : data
  if (!list || list.length === 0) {
    return <div className="muted">まだ収支データがありません</div>
  }

  const points = list.map((d) => ({
    label: `${d.year}/${String(d.month).padStart(2, '0')}`,
    amount: d.balance,
  }))

  const maxAmount = Math.max(...points.map((p) => p.amount), 1)
  const minAmount = Math.min(...points.map((p) => p.amount), 0)
  const padding = 10
  const width = 360
  const height = 180
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const svgPoints = points
    .map((p, i) => {
      const x = padding + i * step
      const ratio = (p.amount - minAmount) / (maxAmount - minAmount || 1)
      const y = height - padding - ratio * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="共通口座収支の推移">
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={svgPoints} />
        {points.map((p, i) => {
          const x = padding + i * step
          const ratio = (p.amount - minAmount) / (maxAmount - minAmount || 1)
          const y = height - padding - ratio * (height - padding * 2)
          return (
            <g key={p.label}>
              <circle cx={x} cy={y} r="4" fill="#2563eb" />
              <text x={x} y={height - 2} textAnchor="middle" fontSize="10" fill="#64748b">
                {p.label}
              </text>
              <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill="#0f172a">
                {p.amount.toLocaleString()}円
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function MiniBalanceChart({ data }: { data: BalanceHistoryItem[] }) {
  return <BalanceChart data={data} limit={6} />
}
