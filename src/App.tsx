import React, { Suspense, useEffect, useMemo, useRef, useState, lazy } from 'react'
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
import { CalculatorIcon, HandshakeIcon, HomeIcon, LockIcon, PencilIcon, HamburgerIcon, BirdIcon } from './components/icons'
const HomeScreen = lazy(() => import('./screens/HomeScreen').then((m) => ({ default: m.HomeScreen })))
const InputScreen = lazy(() => import('./screens/InputScreen').then((m) => ({ default: m.InputScreen })))
const PlanScreen = lazy(() => import('./screens/PlanScreen').then((m) => ({ default: m.PlanScreen })))
const FixedScreen = lazy(() => import('./screens/FixedScreen').then((m) => ({ default: m.FixedScreen })))
const SharedScreen = lazy(() => import('./screens/SharedScreen').then((m) => ({ default: m.SharedScreen })))
import { SettingsModal } from './components/SettingsModal'
import { Modal } from './components/Modal'

type Screen = 'home' | 'input' | 'fixed' | 'shared' | 'plan'
type Tab = { key: Screen; label: string; icon: React.ReactNode }

const defaultMembers = [
  { id: 'husband', label: '夫' },
  { id: 'wife', label: '妻' },
]

const tabs: Tab[] = [
  { key: 'home', label: 'ホーム', icon: <HomeIcon /> },
  { key: 'plan', label: '振込計算', icon: <CalculatorIcon /> },
  { key: 'input', label: '入力', icon: <PencilIcon /> },
  { key: 'fixed', label: '固定費', icon: <LockIcon /> },
  { key: 'shared', label: '共有', icon: <HandshakeIcon /> },
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
  const [summariesByMember, setSummariesByMember] = useState<Record<string, Summary>>({})
  const [recurrents, setRecurrents] = useState<Recurrent[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersSummary, setTransfersSummary] = useState<TransfersResult>({ by_member: {}, total: 0 })
  const [sharedSpending, setSharedSpending] = useState(0)
  const [sharedBalance, setSharedBalance] = useState(0)
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([])
  const [settingsForm, setSettingsForm] = useState({
    husband_name: '',
    wife_name: '',
    husband_image_id: '',
    wife_image_id: '',
  })
  const [profilePreview, setProfilePreview] = useState({ husband: '', wife: '' })
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [editingRecurrent, setEditingRecurrent] = useState<Recurrent | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

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

  const recommendedTransferTotal = useMemo(() => {
    return members.reduce((sum, m) => {
      const fallback = m.id === memberId ? summary.recommended_transfer : 0
      return sum + (summariesByMember[m.id]?.recommended_transfer ?? fallback)
    }, 0)
  }, [members, summariesByMember, memberId, summary.recommended_transfer])

  // 日付入力に基づき year/month を同期（入力タブ表示時のみ）
  useEffect(() => {
    if (screen !== 'input') return
    if (!eventForm.date) return
    const [yStr, mStr] = eventForm.date.split('-')
    const yNum = Number(yStr)
    const mNum = Number(mStr)
    if (Number.isInteger(yNum) && Number.isInteger(mNum)) {
      if (yNum !== year) setYear(yNum)
      if (mNum !== month) setMonth(mNum)
    }
  }, [screen, eventForm.date, year, month])

  // ルートをハッシュで同期し、Pages 直リンクにも耐える
  useEffect(() => {
    const hash = window.location.hash.replace('#/', '')
    if (hash === 'input' || hash === 'fixed' || hash === 'shared' || hash === 'home' || hash === 'plan') {
      setScreen(hash)
    }
    const onHashChange = () => {
      const h = window.location.hash.replace('#/', '')
      if (h === 'input' || h === 'fixed' || h === 'shared' || h === 'home' || h === 'plan') {
        setScreen(h)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    window.location.hash = `#/${screen}`
  }, [screen])

  useEffect(() => {
    if (!loggedIn) {
      setMenuOpen(false)
    }
  }, [loggedIn])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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
    setModal({ type: 'error', message })
  }

  function showSuccess(message: string) {
    setModal({ type: 'success', message })
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
    setSettingsForm({ husband_name: '', wife_name: '', husband_image_id: '', wife_image_id: '' })
    setProfilePreview({ husband: '', wife: '' })
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
      { id: 'husband', label: data.husband_name || '夫', avatar: '' },
      { id: 'wife', label: data.wife_name || '妻', avatar: '' },
    ]
    setMembers(nextMembers)
    if (!nextMembers.find((m) => m.id === memberId)) {
      setMemberId(nextMembers[0]?.id || '')
    }
    setSettingsForm({
      husband_name: nextMembers[0].label,
      wife_name: nextMembers[1].label,
      husband_image_id: data.husband_image_id || '',
      wife_image_id: data.wife_image_id || '',
    })
    setProfilePreview({ husband: '', wife: '' })
    if (data.husband_image_id) fetchProfileImage(data.husband_image_id, 'husband')
    if (data.wife_image_id) fetchProfileImage(data.wife_image_id, 'wife')
  }

  async function loadOverview() {
    if (!token) return
    setLoading(true)
    try {
      const result = await api.overview({ token, member_id: memberId, year, month })
      if (result.status === 'ok' && result.data) {
        const data = result.data
        setItems(data.items)
        setSummary(data.summary)
        setSummariesByMember((prev) => ({ ...prev, [memberId]: data.summary }))
        setTransfers(data.transfer_items || [])
        setTransfersSummary(data.transfers || { by_member: {}, total: 0 })
        setSharedSpending(data.shared_spending || 0)
        setSharedBalance(data.shared_balance || 0)
        const otherMembers = members.filter((m) => m.id !== memberId)
        if (otherMembers.length) {
          // 他のメンバー分の必要振込額も取得して合算表示に備える
          await Promise.all(
            otherMembers.map(async (m) => {
              try {
                const res = await api.overview({ token, member_id: m.id, year, month })
                if (res.status === 'ok' && res.data) {
                  const otherData = res.data
                  setSummariesByMember((prev) => ({ ...prev, [m.id]: otherData.summary }))
                }
              } catch {
                // 合算表示のみで使うため、失敗しても致命的ではない
              }
            }),
          )
        }
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

  async function fetchProfileImage(fileId: string, member: 'husband' | 'wife') {
    if (!token || !fileId) return
    try {
      const result = await api.profileImageGet({ token, file_id: fileId })
      if (result.status === 'ok' && result.data?.data_url) {
        const url = result.data?.data_url || ''
        setProfilePreview((p) => ({ ...p, [member]: url }))
        setMembers((prev) =>
          prev.map((m) => (m.id === member ? { ...m, avatar: url } : m)),
        )
      }
    } catch {
      // 取得失敗は無視（画像なし扱い）
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

  function resizeImageToMax512(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.onload = () => {
          const max = 512
          let { width, height } = img
          if (width <= max && height <= max) return resolve(dataUrl)
          const scale = Math.min(max / width, max / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(dataUrl)
          ctx.drawImage(img, 0, 0, width, height)
          const output = canvas.toDataURL(file.type || 'image/png')
          resolve(output)
        }
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        img.src = dataUrl
      }
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      reader.readAsDataURL(file)
    })
  }

  async function handleSelectImage(member: 'husband' | 'wife', file: File | null) {
    if (!file) return
    if (!token) return showError('未ログインです')
    if (!file.type.startsWith('image/')) return showError('画像ファイルを選択してください')
    await withBusy(async () => {
      try {
        const dataUrl = await resizeImageToMax512(file)
        const prev = member === 'husband' ? settingsForm.husband_image_id : settingsForm.wife_image_id
        const result = await api.profileImageUpload({
          token,
          member_id: member,
          data_url: dataUrl,
          prev_file_id: prev,
        })
        if (result.status === 'ok' && result.data) {
          setSettingsForm((p) => ({
            ...p,
            husband_image_id: member === 'husband' ? result.data!.file_id : p.husband_image_id,
            wife_image_id: member === 'wife' ? result.data!.file_id : p.wife_image_id,
          }))
          setProfilePreview((p) => ({ ...p, [member]: dataUrl }))
          setMembers((prev) =>
            prev.map((m) => (m.id === member ? { ...m, avatar: dataUrl } : m)),
          )
          showSuccess('画像をアップロードしました')
        } else {
          showError(result.message || '画像のアップロードに失敗しました')
        }
      } catch (err) {
        showError('画像の処理に失敗しました')
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
        <div className="brand">
          <BirdIcon className="brand-icon" width={28} height={28} />
          <h1>夫婦の家計簿</h1>
        </div>
        {loggedIn && (
          <div className="menu-wrapper" ref={menuRef}>
            <button
              className="icon-btn"
              type="button"
              aria-label="メニュー"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <HamburgerIcon width={22} height={22} />
            </button>
            {menuOpen && (
              <div className="menu-dropdown" role="menu">
                <button
                  className="menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsModalOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  設定
                </button>
                <button
                  className="menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    handleLogout()
                  }}
                >
                  ログアウト
                </button>
              </div>
            )}
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
            {modal && (
              <Modal open type={modal.type} message={modal.message} onClose={() => setModal(null)} />
            )}

            <Suspense fallback={<div className="muted">画面を読み込み中…</div>}>
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
                  memberId={memberId}
                  setMemberId={setMemberId}
                  year={year}
                  setYear={setYear}
                  month={month}
                  setMonth={setMonth}
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
                  onReload={loadRecurrents}
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
                  items={items}
                  typeLabel={typeLabel}
                  isRecurrentItem={isRecurrentItem}
                  onReload={loadOverview}
                  onQuickTransfer={handleQuickTransfer}
                  onDeleteItem={handleDeleteItem}
                  onGoShared={() => setScreen('shared')}
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
                  recommendedTransferTotal={recommendedTransferTotal}
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

            </Suspense>
          </main>

          <BottomNav active={screen} tabs={tabs} onChange={(key) => setScreen(key as Screen)} />
          <SettingsModal
            open={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            husband={settingsForm.husband_name}
            wife={settingsForm.wife_name}
            husbandImagePreview={profilePreview.husband}
            wifeImagePreview={profilePreview.wife}
            setHusband={(v) => setSettingsForm((p) => ({ ...p, husband_name: v }))}
            setWife={(v) => setSettingsForm((p) => ({ ...p, wife_name: v }))}
            onSelectHusbandImage={(file) => handleSelectImage('husband', file)}
            onSelectWifeImage={(file) => handleSelectImage('wife', file)}
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
