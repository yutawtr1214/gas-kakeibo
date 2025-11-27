import React from 'react'
import type { BalanceHistoryItem, Summary, TransfersResult } from '../lib/api/types'
import { Card } from '../components/Card'
import { SummaryRow } from '../components/SummaryRow'
import { MiniBalanceChart } from '../components/BalanceChart'
import { AlertBanner } from '../components/AlertBanner'

type Props = {
  summary: Summary
  transfersSummary: TransfersResult
  sharedSpending: number
  sharedBalance: number
  balanceHistory: BalanceHistoryItem[]
  onGoShared: () => void
}

export function HomeScreen({
  summary,
  transfersSummary,
  sharedSpending,
  sharedBalance,
  balanceHistory,
  onGoShared,
}: Props) {
  return (
    <section className="stack">
      <Card title="共有口座の現在地" subtitle="残高と今月の差分を確認" highlight>
        <div className="summary-grid">
          <SummaryRow label="今月の実績振込（合計）" value={transfersSummary.total || 0} />
          <SummaryRow label="今月支出（共通口座）" value={sharedSpending} sign="-" />
          <SummaryRow label="現在残高" value={sharedBalance} />
        </div>
        <div className="actions" style={{ marginTop: '12px' }}>
          <button className="ghost" onClick={onGoShared}>
            共有の詳細へ
          </button>
        </div>
      </Card>

      <Card title="収支の推移" subtitle="直近6ヶ月">
        <MiniBalanceChart data={balanceHistory} />
      </Card>

      <AlertBanner
        recommended={summary.recommended_transfer}
        transferred={transfersSummary.total}
        balance={sharedBalance}
        onAction={onGoShared}
      />
    </section>
  )
}
