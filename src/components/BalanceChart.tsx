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
    income: d.transfers, // 収入=振込額
    spending: d.spending,
    balance: d.balance,
  }))

  const maxAbs = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.income), Math.abs(p.spending), Math.abs(p.balance))),
    1,
  )
  const padding = 16
  const width = 360
  const height = 220
  const baseline = height / 2
  const step = points.length > 1 ? (width - padding * 2) / points.length : width - padding * 2
  const barWidth = Math.min(32, step * 0.5)

  const yScale = (value: number) => baseline - (value / maxAbs) * (height / 2 - padding)
  const zeroY = yScale(0)

  const linePoints = points
    .map((p, i) => {
      const x = padding + step * i + barWidth / 2
      const y = yScale(p.balance)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="共通口座収支の推移">
        <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeDasharray="4 4" />
        {points.map((p, i) => {
          const x = padding + step * i
          const incomeHeight = Math.abs(yScale(p.income) - yScale(0))
          const spendingHeight = Math.abs(yScale(-p.spending) - yScale(0))
          return (
            <g key={p.label}>
              <rect
                x={x}
                y={p.income >= 0 ? yScale(p.income) : yScale(0)}
                width={barWidth}
                height={incomeHeight}
                fill="#22c55e"
                rx={4}
              />
              <rect
                x={x + barWidth + 6}
                y={yScale(0)}
                width={barWidth}
                height={spendingHeight}
                fill="#ef4444"
                rx={4}
              />
              <text x={x + barWidth} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748b">
                {p.label}
              </text>
            </g>
          )
        })}
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={linePoints} />
        {points.map((p, i) => {
          const x = padding + step * i + barWidth / 2
          const y = yScale(p.balance)
          return <circle key={`${p.label}-point`} cx={x} cy={y} r="4" fill="#2563eb" />
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#475569', marginTop: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 6, background: '#22c55e', display: 'inline-block' }} />
          収入（振込）
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 6, background: '#ef4444', display: 'inline-block' }} />
          支出
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 12,
              height: 6,
              background: '#2563eb',
              display: 'inline-block',
              borderRadius: 999,
            }}
          />
          収支
        </span>
      </div>
    </div>
  )
}

export function MiniBalanceChart({ data }: { data: BalanceHistoryItem[] }) {
  return <BalanceChart data={data} limit={6} />
}
