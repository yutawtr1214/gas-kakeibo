import React, { useEffect, useMemo, useState } from 'react'
import './App.css'
import { api } from './lib/api/client'
import type {
  BalanceHistoryItem,
  Item,
  ItemType,
  Recurrent,
  Summary,
  Transfer,
  TransfersResult,
} from './lib/api/types'

type Screen = 'home' | 'input' | 'fixed' | 'shared' | 'history' | 'plan'

const members = [
  { id: 'husband', label: '夫' },
  { id: 'wife', label: '妻' },
]

const itemTypeOptions: { value: ItemType; label: string }[] = [
  { value: 'INCOME', label: '収入' },
  { value: 'SHARED_SHOULD_PAY_BUT_PERSONAL_PAID', label: '共通口座で支払うべきものを個人口座から支払った' },
  { value: 'PERSONAL_SHOULD_PAY_BUT_SHARED_PAID', label: '個人口座で支払うべきものを共有口座から支払った' },
  { value: 'POCKET_MONEY', label: 'お小遣い' },
]

function formatDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function typeLabel(t: ItemType) {
  const hit = itemTypeOptions.find((o) => o.value === t)
  return hit ? hit.label : t
}

const initialSummary: Summary = {
  income_total: 0,
  shared_from_personal_total: 0,
  personal_from_shared_total: 0,
  pocket_total: 0,
  recommended_transfer: 0,
}

function App() {
  const today = useMemo(() => new Date(), [])
  const [screen, setScreen] = useState<Screen>('home')
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || '')
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('loggedIn') === 'true')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [memberId, setMemberId] = useState(members[0]?.id || '')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [recurrents, setRecurrents] = useState<Recurrent[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersSummary, setTransfersSummary] = useState<TransfersResult>({ by_member: {}, total: 0 })
  const [sharedSpending, setSharedSpending] = useState(0)
  const [sharedBalance, setSharedBalance] = useState(0)
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([])

  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  const [eventForm, setEventForm] = useState({
    date: formatDateInput(today),
    item_type: '' as ItemType | '',
    amount: '',
    note: '',
  })

  const [recurrentForm, setRecurrentForm] = useState({
    member_id: memberId,
    item_type: '' as ItemType | '',
    amount: '',
    note: '',
    start_y: year,
    start_m: month,
    end_y: '',
    end_m: '',
  })

  const [sharedForm, setSharedForm] = useState({
    amount: '',
    note: '',
  })

  // ルートをハッシュで同期し、Pages 直リンクにも耐える
  useEffect(() => {
    const hash = window.location.hash.replace('#/', '')
    if (hash === 'input' || hash === 'fixed' || hash === 'shared' || hash === 'history' || hash === 'home') {
      setScreen(hash)
    }
    const onHashChange = () => {
      const h = window.location.hash.replace('#/', '')
      if (h === 'input' || h === 'fixed' || h === 'shared' || h === 'history' || h === 'home') {
        setScreen(h)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    window.location.hash = `#/${screen}`
  }, [screen])

  // ログイン後データ読み込み
  useEffect(() => {
    if (!loggedIn || !token) return
    loadOverview()
    loadRecurrents()
    loadBalanceHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, token, memberId, year, month])

  // メンバー変更時は固定費も取得
  useEffect(() => {
    if (!loggedIn || !token) return
    loadRecurrents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  function showError(message: string) {
    setToast({ type: 'error', message })
  }

  function showSuccess(message: string) {
    setToast({ type: 'success', message })
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    if (!loginPassword) {
      setLoginError('パスワードを入力してください')
      return
    }
    setLoading(true)
    try {
      const result = await api.login(loginPassword)
      if (result.status === 'ok') {
        sessionStorage.setItem('loggedIn', 'true')
        sessionStorage.setItem('token', loginPassword)
        setToken(loginPassword)
        setLoggedIn(true)
        setLoginPassword('')
        setScreen('home')
      } else {
        setLoginError(result.message || 'ログインに失敗しました')
      }
    } catch (err) {
      setLoginError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('loggedIn')
    sessionStorage.removeItem('token')
    setLoggedIn(false)
    setToken('')
    setItems([])
    setRecurrents([])
    setTransfers([])
    setTransfersSummary({ by_member: {}, total: 0 })
    setSharedSpending(0)
    setSharedBalance(0)
    setBalanceHistory([])
    setSummary(initialSummary)
  }

  async function loadOverview() {
    if (!token) return
    setLoading(true)
    try {
      const result = await api.overview({ token, member_id: memberId, year, month })
      if (result.status === 'ok' && result.data) {
        setItems(result.data.items)
        setSummary(result.data.summary)
        setTransfers(result.data.transfer_items || [])
        setTransfersSummary(result.data.transfers || { by_member: {}, total: 0 })
        setSharedSpending(result.data.shared_spending || 0)
        setSharedBalance(result.data.shared_balance || 0)
      } else {
        showError(result.message || 'データ取得に失敗しました')
      }
    } catch (err) {
      showError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecurrents() {
    if (!token) return
    try {
      const result = await api.listRecurrents(token, memberId)
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
      } else {
        showError(result.message || '固定費取得に失敗しました')
      }
    } catch {
      showError('通信に失敗しました')
    }
  }

  async function loadBalanceHistory() {
    if (!token) return
    try {
      const result = await api.balanceHistory(token)
      if (result.status === 'ok' && result.data) {
        setBalanceHistory(result.data)
      }
    } catch {
      // 非致命的
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return showError('未ログインです')
    if (!eventForm.item_type || !eventForm.amount) return showError('種別と金額は必須です')
    const amountNum = Number(eventForm.amount)
    if (!Number.isInteger(amountNum) || amountNum <= 0) return showError('金額は1以上の整数で入力してください')

    await withBusy(async () => {
      const result = await api.addItem({
        token,
        member_id: memberId,
        year,
        month,
        date: eventForm.date,
        item_type: eventForm.item_type,
        amount: eventForm.amount,
        note: eventForm.note,
      })
      if (result.status === 'ok' && result.data) {
        setItems(result.data.items)
        setSummary(result.data.summary)
        setEventForm({ ...eventForm, amount: '', note: '' })
        showSuccess('イベントを追加しました')
      } else {
        showError(result.message || '追加に失敗しました')
      }
    })
  }

  async function handleDeleteItem(id: string) {
    if (!token) return
    if (!window.confirm('削除してよろしいですか？')) return
    await withBusy(async () => {
      const result = await api.deleteItem(token, id)
      if (result.status === 'ok' && result.data) {
        setItems(result.data.items)
        setSummary(result.data.summary)
      } else {
        showError(result.message || '削除に失敗しました')
      }
    })
  }

  async function handleAddRecurrent(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return showError('未ログインです')
    if (!recurrentForm.item_type || !recurrentForm.amount) return showError('種別と金額は必須です')
    const amountNum = Number(recurrentForm.amount)
    if (!Number.isInteger(amountNum) || amountNum <= 0) return showError('金額は1以上の整数で入力してください')

    await withBusy(async () => {
      const result = await api.addRecurrent({
        token,
        member_id: recurrentForm.member_id,
        item_type: recurrentForm.item_type,
        amount: recurrentForm.amount,
        note: recurrentForm.note,
        start_y: recurrentForm.start_y,
        start_m: recurrentForm.start_m,
        end_y: recurrentForm.end_y || '',
        end_m: recurrentForm.end_m || '',
      })
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
        setRecurrentForm({
          member_id: memberId,
          item_type: '',
          amount: '',
          note: '',
          start_y: year,
          start_m: month,
          end_y: '',
          end_m: '',
        })
        await loadOverview()
        showSuccess('固定費を登録しました')
      } else {
        showError(result.message || '固定費登録に失敗しました')
      }
    })
  }

  async function handleDeleteRecurrent(id: string, ownerId: string) {
    if (!token) return
    if (!window.confirm('この固定費を削除しますか？')) return
    await withBusy(async () => {
      const result = await api.deleteRecurrent(token, id, ownerId)
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
        await loadOverview()
      } else {
        showError(result.message || '削除に失敗しました')
      }
    })
  }

  async function handleQuickTransfer() {
    if (!token) return showError('未ログインです')
    const amount = summary.recommended_transfer
    if (!Number.isFinite(amount) || amount <= 0) {
      return showError('推奨額が0円以下のため登録できません')
    }
    await withBusy(async () => {
      const result = await api.addTransfer({
        token,
        member_id: memberId,
        year,
        month,
        amount,
        note: `${year}年${month}月 推奨額を自動登録`,
      })
      if (result.status === 'ok' && result.data) {
        setTransfers(result.data)
        await loadOverview()
        showSuccess('振込を登録しました')
      } else {
        showError(result.message || '振込登録に失敗しました')
      }
    })
  }

  async function handleDeleteTransfer(id: string) {
    if (!token) return
    if (!window.confirm('この振込記録を削除しますか？')) return
    await withBusy(async () => {
      const result = await api.deleteTransfer(token, id, memberId, year, month)
      if (result.status === 'ok' && result.data) {
        setTransfers(result.data)
        await loadOverview()
      } else {
        showError(result.message || '削除に失敗しました')
      }
    })
  }

  async function handleSharedSpending(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return showError('未ログインです')
    const amountNum = Number(sharedForm.amount)
    if (!Number.isInteger(amountNum) || amountNum < 0) return showError('支出額は0以上の整数で入力してください')
    await withBusy(async () => {
      const result = await api.setSharedSpending({
        token,
        year,
        month,
        amount: amountNum,
        note: sharedForm.note,
      })
      if (result.status === 'ok' && result.data) {
        setSharedSpending(result.data.amount || 0)
        setSharedForm({ amount: '', note: '' })
        await loadOverview()
        await loadBalanceHistory()
        showSuccess('共通口座の支出を更新しました')
      } else {
        showError(result.message || '支出登録に失敗しました')
      }
    })
  }

  if (!apiBasePresent()) {
    return (
      <div className="page">
        <div className="alert error">VITE_API_BASE が設定されていません。</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">共有家計簿</p>
          <h1>月次キャッシュフロー</h1>
        </div>
        {loggedIn && (
          <button className="ghost small" onClick={handleLogout}>
            ログアウト
          </button>
        )}
      </header>

      {!loggedIn ? (
        <div className="auth-card">
          <h2>ログイン</h2>
          <p className="muted">共有パスワードを入力してください。</p>
          <form className="form" onSubmit={handleLogin}>
            <label>
              パスワード
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
              />
            </label>
            {loginError && <p className="error-text">{loginError}</p>}
            <button type="submit" className="primary" disabled={loading}>
              {loading ? '送信中…' : 'ログイン'}
            </button>
          </form>
        </div>
      ) : (
        <>
          <main className="content">
            {toast && (
              <div className={`toast ${toast.type}`}>
                {toast.message}
                <button className="ghost small" onClick={() => setToast(null)}>
                  閉じる
                </button>
              </div>
            )}

            {screen === 'home' && (
              <section className="stack">
                <Card title="共有口座の現在地" subtitle="残高と今月の差分を確認" highlight>
                  <div className="summary-grid">
                    <SummaryRow label="推奨振込額" value={summary.recommended_transfer} />
                    <SummaryRow label="今月の実績振込（合計）" value={transfersSummary.total || 0} />
                    <SummaryRow label="今月支出（共通口座）" value={sharedSpending} sign="-" />
                    <SummaryRow label="現在残高" value={sharedBalance} />
                  </div>
                  <div className="callout">
                    <div>
                      <p className="muted">進捗</p>
                      <div className="big-number">
                        {progressPercent(summary.recommended_transfer, transfersSummary.total)}%
                      </div>
                    </div>
                    <div className="callout-actions">
                      <button
                        className="primary"
                        onClick={handleQuickTransfer}
                        disabled={busy || summary.recommended_transfer <= 0}
                      >
                        推奨額で振込登録
                      </button>
                      <button className="ghost" onClick={() => setScreen('shared')}>
                        共有の詳細へ
                      </button>
                    </div>
                  </div>
                </Card>

                <Card title="収支の推移" subtitle="直近6ヶ月">
                  <MiniBalanceChart data={balanceHistory.slice(-6)} />
                </Card>

                <AlertBanner
                  recommended={summary.recommended_transfer}
                  transferred={transfersSummary.total}
                  balance={sharedBalance}
                  onAction={() => setScreen('shared')}
                />
              </section>
            )}

            {screen === 'input' && (
              <section className="stack">
                <FilterBar
                  memberId={memberId}
                  setMemberId={setMemberId}
                  year={year}
                  setYear={setYear}
                  month={month}
                  setMonth={setMonth}
                  onReload={loadOverview}
                  busy={busy || loading}
                />
                <Card title="イベント入力" subtitle="単発の収支や立替を登録">
                  <form className="form" onSubmit={handleAddItem}>
                    <label>
                      日付
                      <input
                        type="date"
                        value={eventForm.date}
                        onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                      />
                    </label>
                    <label>
                      種別
                      <select
                        value={eventForm.item_type}
                        onChange={(e) => setEventForm({ ...eventForm, item_type: e.target.value as ItemType })}
                      >
                        <option value="">選択してください</option>
                        {itemTypeOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      金額（円・整数）
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={eventForm.amount}
                        onChange={(e) => setEventForm({ ...eventForm, amount: e.target.value })}
                      />
                    </label>
                    <label>
                      メモ（任意）
                      <input
                        type="text"
                        value={eventForm.note}
                        onChange={(e) => setEventForm({ ...eventForm, note: e.target.value })}
                        placeholder="お店・用途など"
                      />
                    </label>
                    <div className="actions">
                      <button type="submit" className="primary" disabled={busy}>
                        {busy ? '送信中…' : '追加する'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          setEventForm({ date: formatDateInput(today), item_type: '', amount: '', note: '' })
                        }
                        disabled={busy}
                      >
                        リセット
                      </button>
                    </div>
                  </form>
                </Card>
                <Card title="最近のイベント" subtitle="直近5件を確認">
                  <div className="list">
                    {items.slice(0, 5).map((item) => (
                      <div key={item.id} className="list-item">
                        <div>
                          <p className="label">
                            {item.date || '-'} / {typeLabel(item.item_type)}
                          </p>
                          <p className="muted">{item.note || '-'}</p>
                        </div>
                        <div className="list-actions">
                          <span className="amount">{item.amount.toLocaleString()}円</span>
                          <button
                            className="ghost danger-text"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={busy}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && <p className="muted">まだデータがありません</p>}
                  </div>
                  <button className="ghost small" onClick={() => setScreen('history')}>
                    履歴をすべて見る
                  </button>
                </Card>
              </section>
            )}

            {screen === 'fixed' && (
              <div className="grid">
                <Card title="固定費を登録" subtitle="毎月発生する支出を先に登録">
                  <form className="form" onSubmit={handleAddRecurrent}>
                    <label>
                      登録者
                      <select
                        value={recurrentForm.member_id}
                        onChange={(e) => setRecurrentForm({ ...recurrentForm, member_id: e.target.value })}
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      種別
                      <select
                        value={recurrentForm.item_type}
                        onChange={(e) =>
                          setRecurrentForm({
                            ...recurrentForm,
                            item_type: e.target.value as ItemType,
                          })
                        }
                      >
                        <option value="">選択してください</option>
                        {itemTypeOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      金額（円・整数）
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={recurrentForm.amount}
                        onChange={(e) => setRecurrentForm({ ...recurrentForm, amount: e.target.value })}
                      />
                    </label>
                    <div className="inline">
                      <label>
                        開始年
                        <input
                          type="number"
                          min={2000}
                          value={recurrentForm.start_y}
                          onChange={(e) => setRecurrentForm({ ...recurrentForm, start_y: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        開始月
                        <select
                          value={recurrentForm.start_m}
                          onChange={(e) => setRecurrentForm({ ...recurrentForm, start_m: Number(e.target.value) })}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                              {m}月
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="inline">
                      <label>
                        終了年（任意）
                        <input
                          type="number"
                          value={recurrentForm.end_y}
                          onChange={(e) => setRecurrentForm({ ...recurrentForm, end_y: e.target.value })}
                          placeholder="例: 2026"
                        />
                      </label>
                      <label>
                        終了月（任意）
                        <select
                          value={recurrentForm.end_m}
                          onChange={(e) => setRecurrentForm({ ...recurrentForm, end_m: e.target.value })}
                        >
                          <option value="">未指定</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                              {m}月
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      メモ（任意）
                      <input
                        type="text"
                        value={recurrentForm.note}
                        onChange={(e) => setRecurrentForm({ ...recurrentForm, note: e.target.value })}
                      />
                    </label>
                    <div className="actions">
                      <button type="submit" className="primary" disabled={busy}>
                        {busy ? '送信中…' : '固定費を追加'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          setRecurrentForm({
                            member_id: memberId,
                            item_type: '',
                            amount: '',
                            note: '',
                            start_y: year,
                            start_m: month,
                            end_y: '',
                            end_m: '',
                          })
                        }
                        disabled={busy}
                      >
                        リセット
                      </button>
                    </div>
                  </form>
                </Card>

                <Card title="固定費一覧" subtitle="スワイプ/削除で管理">
                  <div className="list">
                    {recurrents.length === 0 && <p className="muted">登録された固定費はありません</p>}
                    {recurrents.map((r) => (
                      <div key={r.id} className="list-item">
                        <div>
                          <p className="label">{typeLabel(r.item_type)}</p>
                          <p className="muted">登録者: {members.find((m) => m.id === r.member_id)?.label || r.member_id}</p>
                          <p className="muted">
                            {r.start_y}/{r.start_m} 〜 {r.end_y && r.end_m ? `${r.end_y}/${r.end_m}` : '継続'}
                          </p>
                          <p className="muted">{r.note || '-'}</p>
                        </div>
                        <div className="list-actions">
                          <span className="amount">{r.amount.toLocaleString()}円</span>
                          <button
                            className="ghost danger-text"
                            onClick={() => handleDeleteRecurrent(r.id, r.member_id)}
                            disabled={busy}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {screen === 'plan' && (
              <div className="stack">
                <FilterBar
                  memberId={memberId}
                  setMemberId={setMemberId}
                  year={year}
                  setYear={setYear}
                  month={month}
                  setMonth={setMonth}
                  onReload={loadOverview}
                  busy={busy || loading}
                />
                <Card
                  title="推奨振込額"
                  subtitle={`${year}年${month}月 / ${members.find((m) => m.id === memberId)?.label || ''}`}
                  highlight
                >
                  <div className="summary-grid">
                    <SummaryRow label="推奨振込額" value={summary.recommended_transfer} />
                    <SummaryRow
                      label="実績振込（このメンバー）"
                      value={transfersSummary.by_member[memberId] || 0}
                    />
                    <SummaryRow
                      label="残り振込必要額"
                      value={summary.recommended_transfer - (transfersSummary.by_member[memberId] || 0)}
                    />
                  </div>
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={handleQuickTransfer}
                      disabled={busy || summary.recommended_transfer <= 0}
                    >
                      推奨額で振込登録
                    </button>
                    <button className="ghost" onClick={() => setScreen('shared')}>
                      共有サマリを見る
                    </button>
                  </div>
                </Card>

                <Card title="計算の内訳" subtitle="この月の収支バランス">
                  <div className="summary-grid">
                    <SummaryRow label="収入合計" value={summary.income_total} />
                    <SummaryRow
                      label="共通口座で支払うべきものを個人口座から支払った"
                      value={summary.shared_from_personal_total}
                      sign="-"
                    />
                    <SummaryRow
                      label="個人口座で支払うべきものを共有口座から支払った"
                      value={summary.personal_from_shared_total}
                      sign="+"
                    />
                    <SummaryRow label="お小遣い合計" value={summary.pocket_total} sign="-" />
                    <SummaryRow label="共通口座支出" value={sharedSpending} sign="-" />
                  </div>
                </Card>
              </div>
            )}

            {screen === 'shared' && (
              <div className="stack">
                <PeriodBar
                  year={year}
                  setYear={setYear}
                  month={month}
                  setMonth={setMonth}
                  onReload={loadOverview}
                  busy={busy || loading}
                />
                <Card title="共通口座サマリ" subtitle="推奨額・実績・支出">
                  <div className="summary-grid">
                    <SummaryRow label="推奨振込額" value={summary.recommended_transfer} />
                    <SummaryRow label="実績振込（合計）" value={transfersSummary.total || 0} />
                    <SummaryRow label="共通口座支出" value={sharedSpending} sign="-" />
                    <SummaryRow label="口座収支" value={sharedBalance} />
                  </div>
                </Card>

                <Card title="月次支出を登録" subtitle="共通口座からの支出を記録">
                  <form className="form" onSubmit={handleSharedSpending}>
                    <label>
                      支出額（円・0以上）
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={sharedForm.amount}
                        onChange={(e) => setSharedForm({ ...sharedForm, amount: e.target.value })}
                      />
                    </label>
                    <label>
                      メモ（任意）
                      <input
                        type="text"
                        value={sharedForm.note}
                        onChange={(e) => setSharedForm({ ...sharedForm, note: e.target.value })}
                        placeholder="内訳メモなど"
                      />
                    </label>
                    <div className="actions">
                      <button type="submit" className="primary" disabled={busy}>
                        {busy ? '送信中…' : '支出を登録'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setSharedForm({ amount: '', note: '' })}
                        disabled={busy}
                      >
                        リセット
                      </button>
                    </div>
                  </form>
                </Card>

                <Card title="当月の振込一覧" subtitle="削除して差し替え可能">
                  <div className="list">
                    {transfers.length === 0 && <p className="muted">当月の振込記録はありません</p>}
                    {transfers.map((t) => (
                      <div key={t.id} className="list-item">
                        <div>
                          <p className="label">
                            {members.find((m) => m.id === t.member_id)?.label || t.member_id}
                          </p>
                          <p className="muted">{t.note || '-'}</p>
                        </div>
                        <div className="list-actions">
                          <span className="amount">{t.amount.toLocaleString()}円</span>
                          <button
                            className="ghost danger-text"
                            onClick={() => handleDeleteTransfer(t.id)}
                            disabled={busy}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="共通口座 収支の推移" subtitle="入金-支出の差分を確認">
                  <BalanceChart data={balanceHistory} />
                </Card>
              </div>
            )}

            {screen === 'history' && (
              <div className="grid">
                <Card title="イベント一覧" subtitle="入力内容の確認・削除">
                  <div className="list">
                    {items.length === 0 && <p className="muted">データがありません</p>}
                    {items.map((item) => (
                      <div key={item.id} className="list-item">
                        <div>
                          <p className="label">
                            {item.date || '-'} / {typeLabel(item.item_type)}
                          </p>
                          <p className="muted">{item.note || '-'}</p>
                        </div>
                        <div className="list-actions">
                          <span className="amount">{item.amount.toLocaleString()}円</span>
                          <button
                            className="ghost danger-text"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={busy}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </main>

          <BottomNav active={screen} onChange={setScreen} />
        </>
      )}
    </div>
  )
}

function BottomNav({ active, onChange }: { active: Screen; onChange: (s: Screen) => void }) {
  const tabs: { key: Screen; label: string }[] = [
    { key: 'home', label: 'ホーム' },
    { key: 'plan', label: '振込計算' },
    { key: 'input', label: '入力' },
    { key: 'fixed', label: '固定費' },
    { key: 'shared', label: '共有' },
    { key: 'history', label: '履歴' },
  ]
  return (
    <nav className="bottom-nav" aria-label="主要メニュー">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`nav-btn ${active === t.key ? 'is-active' : ''}`}
          onClick={() => onChange(t.key)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function Card({
  title,
  subtitle,
  children,
  highlight,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <section className={`card ${highlight ? 'card-highlight' : ''}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function FilterBar({
  memberId,
  setMemberId,
  year,
  setYear,
  month,
  setMonth,
  onReload,
  busy,
}: {
  memberId: string
  setMemberId: (id: string) => void
  year: number
  setYear: (y: number) => void
  month: number
  setMonth: (m: number) => void
  onReload: () => void
  busy: boolean
}) {
  return (
    <div className="filter-bar">
      <div className="chip-group" role="group" aria-label="メンバー">
        {members.map((m) => (
          <button
            key={m.id}
            className={`chip ${memberId === m.id ? 'is-active' : ''}`}
            onClick={() => setMemberId(m.id)}
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="period">
        <input type="number" value={year} min={2000} onChange={(e) => setYear(Number(e.target.value))} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
        <button className="ghost small" onClick={onReload} disabled={busy}>
          再読込
        </button>
      </div>
    </div>
  )
}

function PeriodBar({
  year,
  setYear,
  month,
  setMonth,
  onReload,
  busy,
}: {
  year: number
  setYear: (y: number) => void
  month: number
  setMonth: (m: number) => void
  onReload: () => void
  busy: boolean
}) {
  return (
    <div className="filter-bar">
      <div className="period">
        <input type="number" value={year} min={2000} onChange={(e) => setYear(Number(e.target.value))} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
        <button className="ghost small" onClick={onReload} disabled={busy}>
          再読込
        </button>
      </div>
    </div>
  )
}

function MiniBalanceChart({ data }: { data: BalanceHistoryItem[] }) {
  if (!data || data.length === 0) return <div className="muted">まだ収支データがありません</div>
  return <BalanceChart data={data} />
}

function AlertBanner({
  recommended,
  transferred,
  balance,
  onAction,
}: {
  recommended: number
  transferred: number
  balance: number
  onAction: () => void
}) {
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

function SummaryRow({ label, value, sign }: { label: string; value: number; sign?: '+' | '-' }) {
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

function BalanceChart({ data }: { data: BalanceHistoryItem[] }) {
  if (!data || data.length === 0) {
    return <div className="muted">まだ収支データがありません</div>
  }

  const points = data.map((d) => ({
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

function progressPercent(target: number, actual: number) {
  if (!Number.isFinite(target) || target <= 0) return 0
  return Math.min(999, Math.round((actual / target) * 100))
}

function apiBasePresent() {
  return Boolean((import.meta.env.VITE_API_BASE as string | undefined) || '')
}

export default App
