import { lazy, Suspense } from 'react'
import type { BalanceHistoryItem, Summary, TransfersResult } from '../lib/api/types'
import { Card } from '../components/Card'
import { SummaryRow } from '../components/SummaryRow'

const MiniBalanceChart = lazy(async () =>
  import('../components/BalanceChart').then((m) => ({ default: m.MiniBalanceChart })),
)

type Props = {
  summary: Summary
  transfersSummary: TransfersResult
  sharedSpending: number
  sharedBalance: number
  balanceHistory: BalanceHistoryItem[]
  onGoShared: () => void
}

export function HomeScreen({
  summary: _summary,
  transfersSummary: _transfersSummary,
  sharedSpending: _sharedSpending,
  sharedBalance: _sharedBalance,
  balanceHistory,
  onGoShared,
}: Props) {
  const hasHistory = balanceHistory.length > 0
  const totalBalanceDiff = hasHistory
    ? balanceHistory.reduce((sum, h) => sum + (h.transfers - h.spending), 0)
    : 0
  const monthCount = hasHistory ? balanceHistory.length : 1
  const averageBalanceDiff = Math.floor(totalBalanceDiff / monthCount)
  const periodLabel = hasHistory
    ? `${balanceHistory[0].year}/${balanceHistory[0].month} 〜 ${balanceHistory[balanceHistory.length - 1].year}/${balanceHistory[balanceHistory.length - 1].month}`
    : 'データなし'

  return (
    <section className="stack">
      <Card title="累計・平均収支" subtitle="開始からの合計と月平均" highlight>
        <div className="summary-grid">
          <SummaryRow label="累計収支" value={totalBalanceDiff} />
          <SummaryRow label="月平均収支（切り捨て）" value={averageBalanceDiff} />
          <div className="summary-row">
            <span className="summary-label">集計期間</span>
            <span className="summary-value">{periodLabel}</span>
          </div>
        </div>
        {hasHistory && (
          <div className="actions" style={{ marginTop: '12px' }}>
            <button className="ghost" onClick={onGoShared}>
              共有の詳細へ
            </button>
          </div>
        )}
      </Card>

      <Card title="収支の推移">
        <Suspense fallback={<div className="muted">チャートを読み込み中…</div>}>
          <MiniBalanceChart data={balanceHistory} />
        </Suspense>
      </Card>
    </section>
  )
}
