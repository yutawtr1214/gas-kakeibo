import React from 'react'

type Props = {
  recommended: number
  transferred: number
  balance: number
  onAction: () => void
}

export function AlertBanner({ recommended, transferred, balance, onAction }: Props) {
  const deficit = balance < 0
  const short = recommended > 0 && transferred < recommended
  if (!deficit && !short) return null
  return (
    <div className={`toast ${deficit ? 'error' : 'error'}`}>
      <div>
        {deficit && <p>残高がマイナスです。追加の振込または支出確認を行ってください。</p>}
        {short && !deficit && <p>推奨額まで振込が完了していません。早めに対応してください。</p>}
      </div>
      <button className="ghost small" onClick={onAction}>
        確認する
      </button>
    </div>
  )
}
