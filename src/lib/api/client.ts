import type {
  ApiResult,
  BalanceHistoryItem,
  ListResponse,
  OverviewResponse,
  Recurrent,
  Settings,
  Transfer,
} from './types'

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) || ''

if (!apiBase) {
  // ビルド時に検知しやすいように console.warn を出す
  console.warn('VITE_API_BASE が設定されていません')
}

type HttpMethod = 'GET' | 'POST'

async function callApi<T>(params: Record<string, string>, method: HttpMethod = 'POST') {
  if (!apiBase) throw new Error('VITE_API_BASE が未設定です')

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

export const api = {
  login(password: string) {
    return callApi<null>({ mode: 'login', password }, 'POST')
  },
  overview(params: { token: string; member_id: string; year: number; month: number }) {
    const { token, member_id, year, month } = params
    return callApi<OverviewResponse>(
      {
        mode: 'overview_get',
        token,
        member_id,
        year: String(year),
        month: String(month),
      },
      'GET',
    )
  },
  addItem(params: {
    token: string
    member_id: string
    year: number
    month: number
    date: string
    item_type: string
    amount: string
    note: string
  }) {
    return callApi<ListResponse>(
      {
        ...params,
        year: String(params.year),
        month: String(params.month),
        mode: 'item_add',
      },
      'POST',
    )
  },
  deleteItem(token: string, id: string) {
    return callApi<ListResponse>({ mode: 'item_delete', id, token }, 'POST')
  },
  listRecurrents(token: string, member_id: string) {
    return callApi<Recurrent[]>(
      {
        mode: 'recurrent_list',
        token,
        member_id,
      },
      'GET',
    )
  },
  updateRecurrent(params: {
    token: string
    id: string
    start_y: number
    start_m: number
    end_y: string | number | null
    end_m: string | number | null
  }) {
    return callApi<Recurrent[]>({
      ...params,
      start_y: String(params.start_y),
      start_m: String(params.start_m),
      end_y: params.end_y === null ? '' : String(params.end_y),
      end_m: params.end_m === null ? '' : String(params.end_m),
      mode: 'recurrent_update',
    })
  },
  addRecurrent(params: {
    token: string
    member_id: string
    item_type: string
    amount: string
    note: string
    start_y: number
    start_m: number
    end_y: string | number | null
    end_m: string | number | null
  }) {
    return callApi<Recurrent[]>({
      ...params,
      start_y: String(params.start_y),
      start_m: String(params.start_m),
      end_y: params.end_y === null ? '' : String(params.end_y),
      end_m: params.end_m === null ? '' : String(params.end_m),
      mode: 'recurrent_add',
    })
  },
  deleteRecurrent(token: string, id: string, member_id: string) {
    return callApi<Recurrent[]>({
      mode: 'recurrent_delete',
      token,
      id,
      member_id,
    })
  },
  addTransfer(params: {
    token: string
    member_id: string
    year: number
    month: number
    amount: number
    note: string
  }) {
    return callApi<Transfer[]>({
      mode: 'transfer_add',
      token: params.token,
      member_id: params.member_id,
      year: String(params.year),
      month: String(params.month),
      amount: String(Math.round(params.amount)),
      note: params.note,
    })
  },
  deleteTransfer(token: string, id: string, member_id: string, year: number, month: number) {
    return callApi<Transfer[]>({
      mode: 'transfer_delete',
      token,
      id,
      member_id,
      year: String(year),
      month: String(month),
    })
  },
  setSharedSpending(params: { token: string; year: number; month: number; amount: number; note: string }) {
    return callApi<{ amount: number; note: string }>({
      mode: 'spending_set',
      token: params.token,
      year: String(params.year),
      month: String(params.month),
      amount: String(params.amount),
      note: params.note,
    })
  },
  balanceHistory(token: string) {
    return callApi<BalanceHistoryItem[]>({ mode: 'balance_history', token }, 'GET')
  },
  getSettings(token: string) {
    return callApi<Settings>({ mode: 'settings_get', token }, 'GET')
  },
  setSettings(token: string, params: { husband_name: string; wife_name: string }) {
    return callApi<Settings>({
      mode: 'settings_set',
      token,
      husband_name: params.husband_name,
      wife_name: params.wife_name,
    })
  },
}
