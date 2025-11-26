// API でやり取りする型を集約し、UI 層から分離する
export type ItemType =
  | 'INCOME'
  | 'SHARED_SHOULD_PAY_BUT_PERSONAL_PAID'
  | 'PERSONAL_SHOULD_PAY_BUT_SHARED_PAID'
  | 'POCKET_MONEY'

export type Item = {
  id: string
  member_id: string
  year: number
  month: number
  date: string
  item_type: ItemType
  amount: number
  note: string
}

export type Summary = {
  income_total: number
  shared_from_personal_total: number
  personal_from_shared_total: number
  pocket_total: number
  recommended_transfer: number
}

export type ListResponse = {
  items: Item[]
  summary: Summary
}

export type Transfer = {
  id: string
  member_id: string
  year: number
  month: number
  amount: number
  note: string
}

export type TransfersResult = {
  by_member: Record<string, number>
  total: number
}

export type BalanceHistoryItem = {
  year: number
  month: number
  transfers: number
  spending: number
  balance: number
}

export type OverviewResponse = ListResponse & {
  transfers: TransfersResult
  transfer_items: Transfer[]
  shared_spending: number
  shared_balance: number
}

export type Recurrent = {
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

export type ApiResult<T = unknown> = {
  status: 'ok' | 'error'
  data?: T
  message?: string
}
