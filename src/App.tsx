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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      const result = await callApi<ListResponse>(
        {
          mode: 'month_get',
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
    resetForm()
  }

  const recommendedLabel = summary.recommended_transfer >= 0 ? '共通口座へ振込' : '共通口座から補填'

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>共有口座振込額計算</h1>
          <p className="subtitle">GitHub Pages + GAS</p>
        </div>
        {loggedIn && (
          <button className="secondary" onClick={handleLogout}>
            ログアウト
          </button>
        )}
      </header>

      {!loggedIn ? (
        <section className="panel">
          <h2>ログイン</h2>
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
            <button type="submit" disabled={loading}>
              {loading ? '送信中…' : 'ログイン'}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>メンバー・年月</h2>
            <div className="period">
              <label>
                メンバー
                <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                年
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  min={2000}
                />
              </label>
              <label>
                月
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary" onClick={fetchMonthData} disabled={loading}>
                再読み込み
              </button>
            </div>
          </section>

          <section className="panel grid two">
            <div>
              <h2>固定費を登録</h2>
              <form className="form" onSubmit={handleRecurrentSubmit}>
                <label>
                  種別
                  <select
                    value={recurrentForm.item_type}
                    onChange={(e) =>
                      setRecurrentForm({ ...recurrentForm, item_type: e.target.value as ItemType })
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
                    onChange={(e) => setRecurrentForm({ ...recurrentForm, amount: e.target.value })}
                  />
                </label>
                <label>
                  開始年月
                  <div className="inline">
                    <input
                      type="number"
                      value={recurrentForm.start_y}
                      onChange={(e) =>
                        setRecurrentForm({ ...recurrentForm, start_y: Number(e.target.value) })
                      }
                      min={2000}
                    />
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
                  </div>
                </label>
                <label>
                  終了年月（任意）
                  <div className="inline">
                    <input
                      type="number"
                      value={recurrentForm.end_y}
                      onChange={(e) =>
                        setRecurrentForm({ ...recurrentForm, end_y: e.target.value })
                      }
                      placeholder="例: 2026"
                    />
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
                  </div>
                </label>
                <label>
                  メモ（任意）
                  <input
                    type="text"
                    value={recurrentForm.note}
                    onChange={(e) => setRecurrentForm({ ...recurrentForm, note: e.target.value })}
                  />
                </label>
                <div className="actions">
                  <button type="submit" disabled={loading}>
                    {loading ? '送信中…' : '固定費を追加'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetRecurrentForm}
                    disabled={loading}
                  >
                    リセット
                  </button>
                </div>
              </form>
            </div>
            <div>
              <h2>固定費一覧</h2>
              <div className="table-wrap">
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
                        <td>{typeLabel(r.item_type)}</td>
                        <td className="num">{r.amount.toLocaleString()}円</td>
                        <td>
                          {r.start_y}/{r.start_m} 〜{' '}
                          {r.end_y && r.end_m ? `${r.end_y}/${r.end_m}` : '継続'}
                        </td>
                        <td>{r.note}</td>
                        <td className="actions">
                          <button
                            type="button"
                            className="danger"
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

          <section className="panel grid two">
            <div>
              <h2>イベント登録</h2>
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
                  />
                </label>
                <label>
                  メモ（任意）
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </label>
                {error && <p className="error">{error}</p>}
                <div className="actions">
                  <button type="submit" disabled={loading}>
                    {loading ? '送信中…' : '追加'}
                  </button>
                  <button type="button" className="secondary" onClick={resetForm} disabled={loading}>
                    リセット
                  </button>
                </div>
              </form>
            </div>

            <div>
              <h2>月次集計</h2>
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
            </div>
          </section>

          <section className="panel">
            <h2>イベント一覧</h2>
            <div className="table-wrap">
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
                      <td>{item.date || '-'}</td>
                      <td>{typeLabel(item.item_type)}</td>
                      <td className="num">{item.amount.toLocaleString()}円</td>
                      <td>{item.note}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="danger"
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
        </>
      )}
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

export default App
