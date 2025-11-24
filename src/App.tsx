import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Item = {
  id: string
  date: string
  category: string
  amount: number
  payment_method: string
  note: string
}

type Summary = {
  total: number
  byCategory: Record<string, number>
}

type ListResponse = {
  items: Item[]
  summary: Summary
}

type ApiResult<T = unknown> = {
  status: 'ok' | 'error'
  data?: T
  message?: string
}

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) || ''

function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('loggedIn') === 'true')
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || '')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [year, setYear] = useState(() => new Date().getFullYear().toString())
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))

  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, byCategory: {} })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    id: '',
    date: formatDateInput(new Date()),
    category: '',
    amount: '',
    payment_method: '',
    note: '',
  })

  const isEdit = useMemo(() => Boolean(form.id), [form.id])

  useEffect(() => {
    if (loggedIn) fetchList()
  }, [loggedIn, year, month])

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

    const res = await fetch(fetchUrl, { method, headers, body })
    return (await res.json()) as ApiResult<T>
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
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

  async function fetchList() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const result = await callApi<ListResponse>(
        { mode: 'list', year, month, token },
        'GET',
      )
      if (result.status === 'ok' && result.data) {
        setItems(result.data.items)
        setSummary(result.data.summary)
      } else {
        setError(result.message || '一覧取得に失敗しました')
      }
    } catch (err) {
      setError('通信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function onEdit(item: Item) {
    setForm({
      id: item.id,
      date: item.date,
      category: item.category,
      amount: String(item.amount),
      payment_method: item.payment_method,
      note: item.note,
    })
  }

  function resetForm() {
    setForm({
      id: '',
      date: formatDateInput(new Date()),
      category: '',
      amount: '',
      payment_method: '',
      note: '',
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!token) return setError('未ログインです')

    if (!form.date || !form.category || !form.amount) {
      setError('日付・カテゴリ・金額は必須です')
      return
    }
    const amountNum = Number(form.amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('金額は正の数で入力してください')
      return
    }

    setLoading(true)
    setError('')
    try {
      const common = {
        date: form.date,
        category: form.category,
        amount: form.amount,
        payment_method: form.payment_method,
        note: form.note,
        token,
      }

      const result = isEdit
        ? await callApi<null>({ mode: 'update', id: form.id, ...common }, 'POST')
        : await callApi<{ id: string }>({ mode: 'add', ...common }, 'POST')

      if (result.status === 'ok') {
        resetForm()
        await fetchList()
      } else {
        setError(result.message || '保存に失敗しました')
      }
    } catch (err) {
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
      const result = await callApi<null>({ mode: 'delete', id, token }, 'POST')
      if (result.status === 'ok') {
        await fetchList()
      } else {
        setError(result.message || '削除に失敗しました')
      }
    } catch (err) {
      setError('通信に失敗しました')
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
    resetForm()
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>家計簿</h1>
          <p className="subtitle">GAS + Spreadsheet / 簡易パスワード認証</p>
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
          <section className="panel grid two">
            <div>
              <h2>{isEdit ? '支出を更新' : '支出を追加'}</h2>
              <form className="form" onSubmit={handleSubmit}>
                <label>
                  日付
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
                <label>
                  カテゴリ
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </label>
                <label>
                  金額
                  <input
                    type="number"
                    min={0}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </label>
                <label>
                  支払方法
                  <input
                    type="text"
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  />
                </label>
                <label>
                  メモ
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </label>
                <div className="actions">
                  <button type="submit" disabled={loading}>
                    {loading ? '送信中…' : isEdit ? '更新' : '追加'}
                  </button>
                  {isEdit && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={resetForm}
                      disabled={loading}
                    >
                      追加モードに戻す
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div>
              <h2>期間と集計</h2>
              <div className="period">
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  {rangeYears().map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </select>
                <select value={month} onChange={(e) => setMonth(e.target.value)}>
                  {rangeMonths().map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
                <button className="secondary" onClick={fetchList} disabled={loading}>
                  再読み込み
                </button>
              </div>

              <div className="summary">
                <p>
                  {year}年{month}月の合計: <strong>{summary.total.toLocaleString()}円</strong>
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>カテゴリ</th>
                      <th>合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.byCategory).map(([cat, total]) => (
                      <tr key={cat}>
                        <td>{cat || '未設定'}</td>
                        <td className="num">{total.toLocaleString()}円</td>
                      </tr>
                    ))}
                    {Object.keys(summary.byCategory).length === 0 && (
                      <tr>
                        <td colSpan={2} className="muted">
                          データがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>支出一覧</h2>
            {error && <p className="error">{error}</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>カテゴリ</th>
                    <th>金額</th>
                    <th>支払方法</th>
                    <th>メモ</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.date}</td>
                      <td>{item.category}</td>
                      <td className="num">{item.amount.toLocaleString()}円</td>
                      <td>{item.payment_method}</td>
                      <td>{item.note}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => onEdit(item)}
                          disabled={loading}
                        >
                          編集
                        </button>
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
                      <td colSpan={6} className="muted">
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

function formatDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeYears() {
  const current = new Date().getFullYear()
  return [current - 1, current, current + 1].map(String)
}

function rangeMonths() {
  return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
}

export default App
