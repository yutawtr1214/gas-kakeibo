import React, { useEffect, useMemo, useState } from 'react'
import './App.css'

type Item = {
  id: string
  member_id: string
  year: number
  month: number
  date: string
  item_type: ItemType
  amount: number
  note: string
}

type Summary = {
  income_total: number
  shared_from_personal_total: number
  personal_from_shared_total: number
  pocket_total: number
  recommended_transfer: number
}

type ListResponse = {
  items: Item[]
  summary: Summary
}

type Transfer = {
  id: string
  member_id: string
  year: number
  month: number
  amount: number
  note: string
}

type TransfersResult = {
  by_member: Record<string, number>
  total: number
}

type BalanceHistoryItem = {
  year: number
  month: number
  transfers: number
  spending: number
  balance: number
}

type OverviewResponse = ListResponse & {
  transfers: TransfersResult
  transfer_items: Transfer[]
  shared_spending: number
  shared_balance: number
}

type Recurrent = {
  id: string
  member_id: string
  item_type: ItemType
  amount: number
  note: string
  start_y: number
  start_m: number
  end_y: number | null
  end_m: number | null
}

type ApiResult<T = unknown> = {
  status: 'ok' | 'error'
  data?: T
  message?: string
}

type ItemType =
  | 'INCOME'
  | 'SHARED_SHOULD_PAY_BUT_PERSONAL_PAID'
  | 'PERSONAL_SHOULD_PAY_BUT_SHARED_PAID'
  | 'POCKET_MONEY'

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) || ''

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

type TabKey = 'dashboard' | 'event' | 'recurrent' | 'list' | 'shared'
type Tab = { key: TabKey; label: string }

function App() {
  const today = useMemo(() => new Date(), [])
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('loggedIn') === 'true')
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || '')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [memberId, setMemberId] = useState(members[0]?.id || '')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary>({
    income_total: 0,
    shared_from_personal_total: 0,
    personal_from_shared_total: 0,
    pocket_total: 0,
    recommended_transfer: 0,
  })
  const [recurrents, setRecurrents] = useState<Recurrent[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersSummary, setTransfersSummary] = useState<TransfersResult>({ by_member: {}, total: 0 })
  const [sharedSpending, setSharedSpending] = useState(0)
  const [sharedBalance, setSharedBalance] = useState(0)
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')

  const [form, setForm] = useState({
    date: formatDateInput(today),
    item_type: '' as ItemType | '',
    amount: '',
    note: '',
  })
  const [recurrentForm, setRecurrentForm] = useState({
    item_type: '' as ItemType | '',
    amount: '',
    note: '',
    start_y: year,
    start_m: month,
    end_y: '',
    end_m: '',
  })
  const [spendingForm, setSpendingForm] = useState({
    amount: '',
    note: '',
  })

  useEffect(() => {
    if (!loggedIn) return
    fetchBalanceHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  useEffect(() => {
    if (!loggedIn) return
    fetchMonthData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, memberId, year, month])

  useEffect(() => {
    if (!loggedIn) return
    fetchRecurrents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, memberId])

  if (!apiBase) {
    return <div className="container">VITE_API_BASE が設定されていません。</div>
  }

  async function callApi<T>(params: Record<string, string>, method: 'GET' | 'POST' = 'POST') {
    const url = new URL(apiBase)
    params.mode = params.mode || ''

    let fetchUrl = url.toString()
    let body: BodyInit | undefined
    const headers: Record<string, string> = {}

    if (method === 'GET') {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      fetchUrl = url.toString()
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      const usp = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => usp.append(k, v))
      body = usp.toString()
    }

    const res = await fetch(fetchUrl, { method, headers, body, redirect: 'follow' })
    return (await res.json()) as ApiResult<T>
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
      const result = await callApi<null>({ mode: 'login', password: loginPassword }, 'POST')
      if (result.status === 'ok') {
        sessionStorage.setItem('loggedIn', 'true')
        sessionStorage.setItem('token', loginPassword)
        setToken(loginPassword)
        setLoggedIn(true)
        setLoginPassword('')
      } else {
        setLoginError(result.message || 'ログインに失敗しました')
      }
    } catch (err) {
      setLoginError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMonthData() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const result = await callApi<OverviewResponse>(
        {
          mode: 'overview_get',
          token,
          member_id: memberId,
          year: String(year),
          month: String(month),
        },
        'GET',
      )
      if (result.status === 'ok' && result.data) {
        setItems(result.data.items)
        setSummary(result.data.summary)
        setTransfers(result.data.transfer_items || [])
        setTransfersSummary(result.data.transfers || { by_member: {}, total: 0 })
        setSharedSpending(result.data.shared_spending || 0)
        setSharedBalance(result.data.shared_balance || 0)
      } else {
        setError(result.message || 'データ取得に失敗しました')
      }
    } catch (err) {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecurrents() {
    if (!token) return
    try {
      const result = await callApi<Recurrent[]>(
        {
          mode: 'recurrent_list',
          token,
          member_id: memberId,
        },
        'GET',
      )
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
      } else {
        setError(result.message || '固定費取得に失敗しました')
      }
    } catch {
      setError('通信に失敗しました')
    }
  }

  async function handleTransferDelete(id: string) {
    if (!token) return
    if (!window.confirm('この振込記録を削除しますか？')) return
    setLoading(true)
    setError('')
    try {
      const result = await callApi<Transfer[]>({
        mode: 'transfer_delete',
        token,
        id,
        member_id: memberId,
        year: String(year),
        month: String(month),
      })
      if (result.status === 'ok' && result.data) {
        setTransfers(result.data)
        await fetchMonthData()
      } else {
        setError(result.message || '削除に失敗しました')
      }
    } catch {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleSpendingSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return setError('未ログインです')
    if (spendingForm.amount === '') {
      setError('支出額は必須です')
      return
    }
    const amountNum = Number(spendingForm.amount)
    if (!Number.isInteger(amountNum) || amountNum < 0) {
      setError('支出額は0以上の整数で入力してください')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await callApi<{ amount: number; note: string }>({
        mode: 'spending_set',
        token,
        year: String(year),
        month: String(month),
        amount: String(amountNum),
        note: spendingForm.note,
      })
      if (result.status === 'ok' && result.data) {
        setSharedSpending(result.data.amount || 0)
        setSpendingForm({ amount: '', note: '' })
        await fetchMonthData()
        await fetchBalanceHistory()
      } else {
        setError(result.message || '支出登録に失敗しました')
      }
    } catch {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBalanceHistory() {
    if (!token) return
    try {
      const result = await callApi<BalanceHistoryItem[]>({
        mode: 'balance_history',
        token,
      }, 'GET')
      if (result.status === 'ok' && result.data) {
        setBalanceHistory(result.data)
      }
    } catch {
      // 歴史取得は致命的でないため、エラー表示はしない
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return setError('未ログインです')
    if (!form.item_type || !form.amount) {
      setError('種別と金額は必須です')
      return
    }
    const amountNum = Number(form.amount)
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setError('金額は1以上の整数で入力してください')
      return
    }

    setLoading(true)
    setError('')
    try {
      const params = {
        mode: 'item_add',
        token,
        member_id: memberId,
        year: String(year),
        month: String(month),
        date: form.date,
        item_type: form.item_type,
        amount: form.amount,
        note: form.note,
      }
      const result = await callApi<ListResponse>(params, 'POST')
      if (result.status === 'ok' && result.data) {
        resetForm()
        setItems(result.data.items)
        setSummary(result.data.summary)
      } else {
        setError(result.message || '追加に失敗しました')
      }
    } catch (err) {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecurrentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return setError('未ログインです')
    if (!recurrentForm.item_type || !recurrentForm.amount) {
      setError('固定費の種別と金額は必須です')
      return
    }
    const amountNum = Number(recurrentForm.amount)
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setError('固定費の金額は1以上の整数で入力してください')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await callApi<Recurrent[]>({
        mode: 'recurrent_add',
        token,
        member_id: memberId,
        item_type: recurrentForm.item_type,
        amount: recurrentForm.amount,
        note: recurrentForm.note,
        start_y: String(recurrentForm.start_y),
        start_m: String(recurrentForm.start_m),
        end_y: recurrentForm.end_y,
        end_m: recurrentForm.end_m,
      })
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
        resetRecurrentForm()
        await fetchMonthData()
      } else {
        setError(result.message || '固定費の登録に失敗しました')
      }
    } catch {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecurrentDelete(id: string) {
    if (!token) return
    if (!window.confirm('この固定費を削除しますか？')) return
    setLoading(true)
    setError('')
    try {
      const result = await callApi<Recurrent[]>({
        mode: 'recurrent_delete',
        token,
        id,
        member_id: memberId,
      })
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
        await fetchMonthData()
      } else {
        setError(result.message || '固定費の削除に失敗しました')
      }
    } catch {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    if (!window.confirm('削除してよろしいですか？')) return
    setLoading(true)
    setError('')
    try {
      const result = await callApi<ListResponse>({ mode: 'item_delete', id, token }, 'POST')
      if (result.status === 'ok' && result.data) {
        setItems(result.data.items)
        setSummary(result.data.summary)
      } else {
        setError(result.message || '削除に失敗しました')
      }
    } catch (err) {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      date: formatDateInput(today),
      item_type: '',
      amount: '',
      note: '',
    })
  }

  function resetRecurrentForm() {
    setRecurrentForm({
      item_type: '',
      amount: '',
      note: '',
      start_y: year,
      start_m: month,
      end_y: '',
      end_m: '',
    })
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
    resetForm()
    setSpendingForm({ amount: '', note: '' })
  }

  const recommendedLabel = summary.recommended_transfer >= 0 ? '共通口座へ振込' : '共通口座から補填'
  const tabs: Tab[] = [
    { key: 'dashboard', label: 'ダッシュボード' },
    { key: 'event', label: 'イベント登録' },
    { key: 'recurrent', label: '固定費' },
    { key: 'list', label: 'イベント一覧' },
    { key: 'shared' as TabKey, label: '共有口座実績' },
  ]

  async function handleQuickTransfer() {
    if (!token) return setError('未ログインです')
    const amount = summary.recommended_transfer
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('推奨額が0円以下のため、自動登録できません')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await callApi<Transfer[]>({
        mode: 'transfer_add',
        token,
        member_id: memberId,
        year: String(year),
        month: String(month),
        amount: String(Math.round(amount)),
        note: `${year}年${month}月 推奨額を自動登録`,
      })
      if (result.status === 'ok' && result.data) {
        setTransfers(result.data)
        await fetchMonthData()
      } else {
        setError(result.message || '推奨額の登録に失敗しました')
      }
    } catch {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__text">
          <p className="eyebrow">月次キャッシュフロー</p>
          <h1>共有口座振込額計算</h1>
          <p className="subtitle">GitHub Pages + GAS</p>
        </div>
        {loggedIn && (
          <button className="ghost" onClick={handleLogout}>
            ログアウト
          </button>
        )}
      </header>

      <main className="content">
        {!loggedIn ? (
          <section className="card">
            <div className="section-title">
              <h2>ログイン</h2>
              <p>共有パスワードを入力して続行してください。</p>
            </div>
            <form className="form" onSubmit={handleLogin}>
              <label>
                共有パスワード
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoFocus
                />
              </label>
              {loginError && <p className="error">{loginError}</p>}
              <button type="submit" className="primary" disabled={loading}>
                {loading ? '送信中…' : 'ログイン'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="card surface">
              <div className="section-title">
                <h2>メンバー・期間</h2>
                <p>切り替えると即時に該当月のデータを表示します。</p>
              </div>
              <div className="toolbar">
                <label className="field">
                  <span>メンバー</span>
                  <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field short">
                  <span>年</span>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={2000}
                    inputMode="numeric"
                  />
                </label>
                <label className="field short">
                  <span>月</span>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ghost" onClick={fetchMonthData} disabled={loading}>
                  再読み込み
                </button>
              </div>
            </section>

            <nav className="tabs" aria-label="主要メニュー">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${activeTab === t.key ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {error && (
              <div className="card surface" role="alert">
                <p className="error">{error}</p>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <section className="card-grid two">
                <div className="card surface highlight">
                  <div className="section-title">
                    <h2>月次集計</h2>
                    <p>今月の着地を素早く把握できます。</p>
                  </div>
                  <div className="summary">
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
                    <div className="summary-highlight">
                      <div className="summary-label">{recommendedLabel}</div>
                      <div className="summary-value">
                        {summary.recommended_transfer.toLocaleString()}円
                      </div>
                    </div>
                  </div>
                  <div className="actions compact">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => setActiveTab('event')}
                    >
                      イベントを追加
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setActiveTab('recurrent')}
                    >
                      固定費を登録
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setActiveTab('shared')}
                    >
                      共有タブへ
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={handleQuickTransfer}
                      disabled={loading || summary.recommended_transfer <= 0}
                    >
                      {loading ? '送信中…' : `${year}年${month}月の振込を完了`}
                    </button>
                  </div>
                </div>

                <div className="card surface">
                  <div className="section-title">
                    <h2>固定費サマリ</h2>
                    <p>期間と金額の概要を確認できます。</p>
                  </div>
                  <div className="table-wrap small-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>種別</th>
                          <th>金額</th>
                          <th>期間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recurrents.map((r) => (
                          <tr key={r.id}>
                            <td>{typeLabel(r.item_type)}</td>
                            <td className="num">{r.amount.toLocaleString()}円</td>
                            <td>
                              {r.start_y}/{r.start_m} 〜{' '}
                              {r.end_y && r.end_m ? `${r.end_y}/${r.end_m}` : '継続'}
                            </td>
                          </tr>
                        ))}
                        {recurrents.length === 0 && (
                          <tr>
                            <td colSpan={3} className="muted">
                              登録された固定費はありません
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'event' && (
              <section className="card surface">
                <div className="section-title">
                  <h2>イベント登録</h2>
                  <p>一度きりの支出・振替はこちらから追加します。</p>
                </div>
                <form className="form" onSubmit={handleSubmit}>
                  <label>
                    日付（任意）
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </label>
                  <label>
                    種別
                    <select
                      value={form.item_type}
                      onChange={(e) => setForm({ ...form, item_type: e.target.value as ItemType })}
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
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                      inputMode="numeric"
                    />
                  </label>
                  <label>
                    メモ（任意）
                    <input
                      type="text"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="お店・用途など"
                    />
                  </label>
                  {error && <p className="error">{error}</p>}
                  <div className="actions">
                    <button type="submit" className="primary" disabled={loading}>
                      {loading ? '送信中…' : '追加'}
                    </button>
                    <button type="button" className="ghost" onClick={resetForm} disabled={loading}>
                      リセット
                    </button>
                  </div>
                </form>
              </section>
            )}

            {activeTab === 'recurrent' && (
              <section className="card-grid two">
                <div className="card surface">
                  <div className="section-title">
                    <h2>固定費を登録</h2>
                    <p>毎月発生する支出・振替を先に登録しておきます。</p>
                  </div>
                  <form className="form" onSubmit={handleRecurrentSubmit}>
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
                        value={recurrentForm.amount}
                        onChange={(e) =>
                          setRecurrentForm({ ...recurrentForm, amount: e.target.value })
                        }
                        inputMode="numeric"
                      />
                    </label>
                    <div className="inline-pair">
                      <label>
                        開始年
                        <input
                          type="number"
                          value={recurrentForm.start_y}
                          onChange={(e) =>
                            setRecurrentForm({ ...recurrentForm, start_y: Number(e.target.value) })
                          }
                          min={2000}
                          inputMode="numeric"
                        />
                      </label>
                      <label>
                        開始月
                        <select
                          value={recurrentForm.start_m}
                          onChange={(e) =>
                            setRecurrentForm({ ...recurrentForm, start_m: Number(e.target.value) })
                          }
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="inline-pair">
                      <label>
                        終了年（任意）
                        <input
                          type="number"
                          value={recurrentForm.end_y}
                          onChange={(e) =>
                            setRecurrentForm({ ...recurrentForm, end_y: e.target.value })
                          }
                          placeholder="例: 2026"
                          inputMode="numeric"
                        />
                      </label>
                      <label>
                        終了月（任意）
                        <select
                          value={recurrentForm.end_m}
                          onChange={(e) =>
                            setRecurrentForm({ ...recurrentForm, end_m: e.target.value })
                          }
                        >
                          <option value="">未指定</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                              {m}
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
                        onChange={(e) =>
                          setRecurrentForm({ ...recurrentForm, note: e.target.value })
                        }
                        placeholder="用途や備考を入力"
                      />
                    </label>
                    <div className="actions">
                      <button type="submit" className="primary" disabled={loading}>
                        {loading ? '送信中…' : '固定費を追加'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={resetRecurrentForm}
                        disabled={loading}
                      >
                        リセット
                      </button>
                    </div>
                  </form>
                </div>
                <div className="card surface">
                  <div className="section-title">
                    <h2>固定費一覧</h2>
                    <p>期間と金額を確認し、不要なものは削除できます。</p>
                  </div>
                  <div className="table-wrap responsive fixed-height">
                    <table>
                      <thead>
                        <tr>
                          <th>種別</th>
                          <th>金額</th>
                          <th>期間</th>
                          <th>メモ</th>
                          <th>削除</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recurrents.map((r) => (
                          <tr key={r.id}>
                            <td data-label="種別">{typeLabel(r.item_type)}</td>
                            <td data-label="金額" className="num">
                              {r.amount.toLocaleString()}円
                            </td>
                            <td data-label="期間">
                              {r.start_y}/{r.start_m} 〜{' '}
                              {r.end_y && r.end_m ? `${r.end_y}/${r.end_m}` : '継続'}
                            </td>
                            <td data-label="メモ">{r.note || '-'}</td>
                            <td className="actions" data-label="削除">
                              <button
                                type="button"
                                className="danger ghost-text"
                                onClick={() => handleRecurrentDelete(r.id)}
                                disabled={loading}
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                        ))}
                        {recurrents.length === 0 && (
                          <tr>
                            <td colSpan={5} className="muted">
                              登録された固定費はありません
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'shared' && (
              <>
                <section className="card-grid two">
                  <div className="card surface highlight">
                    <div className="section-title">
                      <h2>共有口座サマリ</h2>
                      <p>推奨額と実績、収支を確認できます。</p>
                    </div>
                    <div className="summary">
                      <SummaryRow label="当月推奨振込額" value={summary.recommended_transfer} />
                      <SummaryRow
                        label={`${members.find((m) => m.id === memberId)?.label || ''}の実績振込`}
                        value={transfersSummary.by_member[memberId] || 0}
                      />
                      <SummaryRow label="実績合計（夫婦合計）" value={transfersSummary.total || 0} />
                      <SummaryRow label="共通口座 月次支出" value={sharedSpending} sign="-" />
                      <SummaryRow label="口座収支（入金-支出）" value={sharedBalance} />
                    </div>
                  </div>

                  <div className="card surface">
                    <div className="section-title">
                      <h2>振込登録について</h2>
                      <p>振込はダッシュボードの「振込を完了」ボタンから自動登録してください。</p>
                    </div>
                    <div className="muted">
                      ボタンで登録後、必要に応じて下の一覧から削除できます。
                    </div>
                  </div>
                </section>

                <section className="card-grid two">
                  <div className="card surface">
                    <div className="section-title">
                      <h2>月次共通口座支出</h2>
                      <p>その月の共通口座からの総支出額を入力します。</p>
                    </div>
                    <form className="form" onSubmit={handleSpendingSubmit}>
                      <label>
                        支出額（円・整数・0以上）
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={spendingForm.amount}
                          onChange={(e) =>
                            setSpendingForm({ ...spendingForm, amount: e.target.value })
                          }
                          inputMode="numeric"
                          required
                        />
                      </label>
                      <label>
                        メモ（任意）
                        <input
                          type="text"
                          value={spendingForm.note}
                          onChange={(e) =>
                            setSpendingForm({ ...spendingForm, note: e.target.value })
                          }
                          placeholder="内訳メモなど"
                        />
                      </label>
                      <div className="actions">
                        <button type="submit" className="primary" disabled={loading}>
                          {loading ? '送信中…' : '支出を登録'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setSpendingForm({ amount: '', note: '' })}
                          disabled={loading}
                        >
                          リセット
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="card surface">
                    <div className="section-title">
                      <h2>当月の振込一覧</h2>
                      <p>夫婦それぞれの振込履歴を確認・削除できます。</p>
                    </div>
                    <div className="table-wrap responsive fixed-height">
                      <table>
                        <thead>
                          <tr>
                            <th>メンバー</th>
                            <th>金額</th>
                            <th>メモ</th>
                            <th>削除</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transfers.map((t) => (
                            <tr key={t.id}>
                              <td data-label="メンバー">
                                {members.find((m) => m.id === t.member_id)?.label || t.member_id}
                              </td>
                              <td data-label="金額" className="num">
                                {t.amount.toLocaleString()}円
                              </td>
                              <td data-label="メモ">{t.note || '-'}</td>
                              <td className="actions" data-label="削除">
                                <button
                                  type="button"
                                  className="danger ghost-text"
                                  onClick={() => handleTransferDelete(t.id)}
                                  disabled={loading}
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))}
                          {transfers.length === 0 && (
                            <tr>
                              <td colSpan={4} className="muted">
                                当月の振込記録はありません
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="card surface">
                  <div className="section-title">
                    <h2>共通口座 収支の推移</h2>
                    <p>入金合計と支出との差分を折れ線で確認できます。</p>
                  </div>
                  <BalanceChart data={balanceHistory} />
                </section>
              </>
            )}

            {activeTab === 'list' && (
              <section className="card surface">
                <div className="section-title">
                  <h2>イベント一覧</h2>
                  <p>入力内容を確認し、誤りはすぐに削除できます。</p>
                </div>
                <div className="table-wrap responsive fixed-height">
                  <table>
                    <thead>
                      <tr>
                        <th>日付</th>
                        <th>種別</th>
                        <th>金額</th>
                        <th>メモ</th>
                        <th>削除</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td data-label="日付">{item.date || '-'}</td>
                          <td data-label="種別">{typeLabel(item.item_type)}</td>
                          <td data-label="金額" className="num">
                            {item.amount.toLocaleString()}円
                          </td>
                          <td data-label="メモ">{item.note || '-'}</td>
                          <td className="actions" data-label="削除">
                            <button
                              type="button"
                              className="danger ghost-text"
                              onClick={() => handleDelete(item.id)}
                              disabled={loading}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="muted">
                            データがありません
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  sign,
}: {
  label: string
  value: number
  sign?: '+' | '-'
}) {
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

function typeLabel(t: ItemType) {
  const hit = itemTypeOptions.find((o) => o.value === t)
  return hit ? hit.label : t
}

function formatDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
  const padding = 10
  const width = 600
  const height = 200
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const svgPoints = points
    .map((p, i) => {
      const x = padding + i * step
      const y = height - padding - (p.amount / maxAmount) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="月次支出の推移">
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={svgPoints} />
        {points.map((p, i) => {
          const x = padding + i * step
          const y = height - padding - (p.amount / maxAmount) * (height - padding * 2)
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

export default App
