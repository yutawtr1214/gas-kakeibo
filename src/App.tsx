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
  Settings,
} from './lib/api/types'
import { BottomNav } from './components/BottomNav'
import { HomeScreen } from './screens/HomeScreen'
import { InputScreen } from './screens/InputScreen'
import { PlanScreen } from './screens/PlanScreen'
import { FixedScreen } from './screens/FixedScreen'
import { SharedScreen } from './screens/SharedScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { SettingsModal } from './components/SettingsModal'

type Screen = 'home' | 'input' | 'fixed' | 'shared' | 'history' | 'plan'

const defaultMembers = [
  { id: 'husband', label: '夫' },
  { id: 'wife', label: '妻' },
]

const tabs: { key: Screen; label: string }[] = [
  { key: 'home', label: 'ホーム' },
  { key: 'plan', label: '振込計算' },
  { key: 'input', label: '入力' },
  { key: 'fixed', label: '固定費' },
  { key: 'shared', label: '共有' },
  { key: 'history', label: '履歴' },
]

const itemTypeOptions: { value: ItemType; label: string }[] = [
  { value: 'INCOME', label: '収入' },
  { value: 'SHARED_SHOULD_PAY_BUT_PERSONAL_PAID', label: '個人口座から立て替え' },
  { value: 'PERSONAL_SHOULD_PAY_BUT_SHARED_PAID', label: '共有口座で前借り' },
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

function isRecurrentItem(item: Item) {
  return item.id.startsWith('rec_')
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

  const [members, setMembers] = useState(defaultMembers)
  const [memberId, setMemberId] = useState(defaultMembers[0]?.id || '')
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
  const [settingsForm, setSettingsForm] = useState({ husband_name: '', wife_name: '' })
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [editingRecurrent, setEditingRecurrent] = useState<Recurrent | null>(null)

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
    loadSettings()
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

  function parseAmount(raw: string | number, label: string, allowZero = false) {
    const num = Number(raw)
    const min = allowZero ? 0 : 1
    if (!Number.isInteger(num) || num < min) {
      showError(`${label}は${min}以上の整数で入力してください`)
      return null
    }
    return num
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
    setMembers(defaultMembers)
    setSettingsForm({ husband_name: '', wife_name: '' })
  }

  async function loadSettings() {
    if (!token) return
    try {
      const result = await api.getSettings(token)
      if (result.status === 'ok' && result.data) {
        applySettings(result.data)
      } else {
        applySettings({ husband_name: '夫', wife_name: '妻', updated_at: '' })
      }
    } catch {
      applySettings({ husband_name: '夫', wife_name: '妻', updated_at: '' })
    }
  }

  function applySettings(data: Settings) {
    const nextMembers = [
      { id: 'husband', label: data.husband_name || '夫' },
      { id: 'wife', label: data.wife_name || '妻' },
    ]
    setMembers(nextMembers)
    if (!nextMembers.find((m) => m.id === memberId)) {
      setMemberId(nextMembers[0]?.id || '')
    }
    setSettingsForm({ husband_name: nextMembers[0].label, wife_name: nextMembers[1].label })
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
    const amountNum = parseAmount(eventForm.amount, '金額')
    if (amountNum === null) return

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
    const amountNum = parseAmount(recurrentForm.amount, '金額')
    if (amountNum === null) return

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
    if (!window.confirm('この固定費を削除すると過去の月の計上にも影響する可能性があります。削除しますか？')) return
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

  async function handleUpdateRecurrent(payload: {
    id: string
    start_y: number
    start_m: number
    end_y: string | number | null
    end_m: string | number | null
  }) {
    if (!token) return
    await withBusy(async () => {
      const result = await api.updateRecurrent({ token, ...payload })
      if (result.status === 'ok' && result.data) {
        setRecurrents(result.data)
        setEditingRecurrent(null)
        await loadOverview()
        showSuccess('固定費の期間を更新しました')
      } else {
        showError(result.message || '更新に失敗しました')
      }
    })
  }

  async function handleQuickTransfer() {
    if (!token) return showError('未ログインです')
    const amount = summary.recommended_transfer
    if (!Number.isFinite(amount) || amount <= 0) {
      return showError('必要振込額が0円以下のため登録できません')
    }
    await withBusy(async () => {
      const result = await api.addTransfer({
        token,
        member_id: memberId,
        year,
        month,
        amount,
        note: `${year}年${month}月 必要額を自動登録`,
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
    const amountNum = parseAmount(sharedForm.amount, '支出額', true)
    if (amountNum === null) return
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

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    const maxLen = 5
    if (settingsForm.husband_name.length > maxLen || settingsForm.wife_name.length > maxLen) {
      return showError(`名前は${maxLen}文字以内で入力してください`)
    }
    await withBusy(async () => {
      const result = await api.setSettings(token, settingsForm)
      if (result.status === 'ok' && result.data) {
        applySettings(result.data)
        showSuccess('設定を保存しました')
        setSettingsModalOpen(false)
      } else {
        showError(result.message || '設定の保存に失敗しました')
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
          <div className="inline" style={{ gap: 8 }}>
            <button className="ghost small" onClick={() => setSettingsModalOpen(true)}>
              設定
            </button>
            <button className="ghost small" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
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
              <HomeScreen
                summary={summary}
                transfersSummary={transfersSummary}
                sharedSpending={sharedSpending}
                sharedBalance={sharedBalance}
                balanceHistory={balanceHistory}
                onGoShared={() => setScreen('shared')}
              />
            )}

            {screen === 'input' && (
              <InputScreen
                members={members}
                memberId={memberId}
                setMemberId={setMemberId}
                year={year}
                setYear={setYear}
                month={month}
                setMonth={setMonth}
                busy={busy}
                loading={loading}
                itemTypeOptions={itemTypeOptions}
                eventForm={eventForm}
                setEventForm={setEventForm}
                onSubmit={handleAddItem}
                onReset={() => setEventForm({ date: formatDateInput(today), item_type: '', amount: '', note: '' })}
                onReload={loadOverview}
              />
            )}

            {screen === 'fixed' && (
              <FixedScreen
                members={members}
                itemTypeOptions={itemTypeOptions}
                recurrentForm={recurrentForm}
                setRecurrentForm={setRecurrentForm}
                recurrents={recurrents}
                busy={busy}
                onSubmit={handleAddRecurrent}
                onReset={() =>
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
                onDelete={handleDeleteRecurrent}
                onEdit={(r) => setEditingRecurrent(r)}
                editing={editingRecurrent}
                onUpdate={handleUpdateRecurrent}
              />
            )}

            {screen === 'plan' && (
              <PlanScreen
                members={members}
                memberId={memberId}
                setMemberId={setMemberId}
                year={year}
                setYear={setYear}
                month={month}
                setMonth={setMonth}
                busy={busy}
                loading={loading}
                summary={summary}
                transfersSummary={transfersSummary}
                sharedSpending={sharedSpending}
                items={items}
                typeLabel={typeLabel}
                isRecurrentItem={isRecurrentItem}
                onReload={loadOverview}
                onQuickTransfer={handleQuickTransfer}
                onDeleteItem={handleDeleteItem}
                onGoShared={() => setScreen('shared')}
                onGoHistory={() => setScreen('history')}
              />
            )}

            {screen === 'shared' && (
              <SharedScreen
                members={members}
                year={year}
                setYear={setYear}
                month={month}
                setMonth={setMonth}
                busy={busy}
                loading={loading}
                summary={summary}
                transfersSummary={transfersSummary}
                sharedSpending={sharedSpending}
                sharedBalance={sharedBalance}
                balanceHistory={balanceHistory}
                transfers={transfers}
                sharedForm={sharedForm}
                setSharedForm={setSharedForm}
                onReload={loadOverview}
                onSubmitShared={handleSharedSpending}
                onDeleteTransfer={handleDeleteTransfer}
              />
            )}

            {screen === 'history' && (
              <HistoryScreen
                items={items}
                busy={busy}
                typeLabel={typeLabel}
                isRecurrentItem={isRecurrentItem}
                onDeleteItem={handleDeleteItem}
              />
            )}
          </main>

          <BottomNav active={screen} tabs={tabs} onChange={(key) => setScreen(key as Screen)} />
          <SettingsModal
            open={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            husband={settingsForm.husband_name}
            wife={settingsForm.wife_name}
            setHusband={(v) => setSettingsForm((p) => ({ ...p, husband_name: v }))}
            setWife={(v) => setSettingsForm((p) => ({ ...p, wife_name: v }))}
            onSubmit={handleSaveSettings}
            busy={busy}
          />
        </>
      )}
    </div>
  )
}

function apiBasePresent() {
  return Boolean((import.meta.env.VITE_API_BASE as string | undefined) || '')
}

export default App
