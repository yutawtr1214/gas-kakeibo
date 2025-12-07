import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { BalanceHistoryItem } from '../lib/api/types'

type ChartProps = {
  data: BalanceHistoryItem[]
  limit?: number
}

const toTenThousand = (value: number) => `${Math.round(value / 10000)}万`

type BalanceTooltipProps = TooltipContentProps<number, string> & {
  labelFromIndex: (v: number | string) => string
  currencyFormatter: Intl.NumberFormat
}

function BalanceTooltip({ label, payload, labelFromIndex, currencyFormatter }: BalanceTooltipProps) {
  if (!payload || payload.length === 0) return null

  const valueMap = Object.fromEntries(payload.map((p: any) => [p.dataKey as string, Number(p.value)]))
  const rows: { key: 'income' | 'spending' | 'balance'; label: string; color: string; bg: string }[] = [
    { key: 'income', label: '収入（振込）', color: '#166534', bg: '#dcfce7' },
    { key: 'spending', label: '支出', color: '#b91c1c', bg: '#fee2e2' },
    { key: 'balance', label: '収支', color: '#075985', bg: '#e0f2fe' },
  ]

  const monthLabel = labelFromIndex(label ?? '')

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__header">{monthLabel || '—'}</div>
      <div className="chart-tooltip__rows">
        {rows.map((row) => {
          const rawValue = valueMap[row.key]
          const display =
            rawValue === undefined ? '—' : `${currencyFormatter.format(row.key === 'spending' ? Math.abs(rawValue) : rawValue)}円`
          return (
            <div className="chart-tooltip__row" key={row.key}>
              <span className="chart-tooltip__label">
                <span className="chart-tooltip__pill" style={{ color: row.color, background: row.bg }}>
                  {row.label}
                </span>
              </span>
              <span className="chart-tooltip__value">{display}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BalanceChart({ data, limit }: ChartProps) {
  const points = useMemo(
    () =>
      data.map((d, idx) => ({
        idx,
        label: `${d.year}/${String(d.month).padStart(2, '0')}`,
        income: Math.max(d.transfers, 0), // 正方向のみ
        spending: -Math.abs(d.spending || 0), // 常にマイナス方向に配置（未定義対策）
        balance: d.balance,
      })),
    [data],
  )
  const hasPoints = points.length > 0

  const valueAbsMax = hasPoints
    ? Math.max(...points.map((p) => Math.max(Math.abs(p.income), Math.abs(p.spending), Math.abs(p.balance))))
    : 1
  const tickStep = 100000 // 10万円刻み
  const tickMax = Math.ceil(valueAbsMax / tickStep) * tickStep
  const ticks: number[] = []
  for (let v = -tickMax; v <= tickMax; v += tickStep) {
    ticks.push(v)
  }

  const currencyFormatter = new Intl.NumberFormat('ja-JP')

  const viewCount = limit ?? 12
  const maxStart = Math.max(points.length - viewCount, 0)
  const [startIndex, setStartIndex] = useState(maxStart)
  const clampStart = (next: number) => Math.max(0, Math.min(maxStart, next))
  const touchStartX = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const moveWindow = (delta: number) => {
    setStartIndex((prev) => clampStart(prev + delta))
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) < 4) return
    moveWindow(e.deltaX > 0 ? 1 : -1)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    const threshold = 24
    if (Math.abs(dx) >= threshold) {
      moveWindow(dx < 0 ? 1 : -1)
    }
    touchStartX.current = null
  }

  const endIndex = startIndex + viewCount - 1
  const ticksX = points.slice(startIndex, startIndex + viewCount).map((p) => p.idx)
  const labelFromIndex = (index: number | string) => {
    const i = typeof index === 'number' ? index : Number(index)
    return points[i]?.label ?? ''
  }

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const scheduleHide = () => {
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => setTooltipVisible(false), 1500)
  }

  const handleTooltipChange = () => {
    setTooltipVisible(true)
    scheduleHide()
  }

  const handleMouseLeave = () => {
    setTooltipVisible(false)
    clearHideTimer()
  }

  useEffect(() => () => clearHideTimer(), [])

  if (!hasPoints) {
    return <div className="muted">まだ収支データがありません</div>
  }

  return (
    <div className="chart" onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={points}
          margin={{ top: 16, right: 16, bottom: 24, left: 12 }}
          barCategoryGap="10%"
          onMouseMove={handleTooltipChange}
          onClick={handleTooltipChange}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="idx"
            type="number"
            tick={{ fontSize: 11, fill: '#475569' }}
            height={28}
            domain={[startIndex, endIndex]}
            ticks={ticksX}
            allowDataOverflow
            tickFormatter={(v) => points[v]?.label ?? ''}
          />
          <YAxis
            ticks={ticks}
            tickFormatter={toTenThousand}
            tick={{ fontSize: 11, fill: '#475569' }}
            width={44}
            domain={[-tickMax, tickMax]}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
          <Tooltip<number, string>
            content={(props) => (
              <BalanceTooltip
                {...props}
                labelFromIndex={labelFromIndex}
                currencyFormatter={currencyFormatter}
              />
            )}
            active={tooltipVisible}
            cursor={{ fill: 'rgba(29, 155, 240, 0.06)' }}
            isAnimationActive={false}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => (value === 'spending' ? '支出' : value === 'income' ? '収入（振込）' : '収支')}
          />
          <Bar dataKey="income" fill="#22c55e" barSize={18} radius={[4, 4, 0, 0]} />
          <Bar dataKey="spending" fill="#ef4444" barSize={18} radius={[0, 0, 4, 4]} />
          <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniBalanceChart({ data }: { data: BalanceHistoryItem[] }) {
  // ホームでも共有と同じ動き（12ヶ月ビューをスワイプ）にするため limit 未指定
  return <BalanceChart data={data} />
}
