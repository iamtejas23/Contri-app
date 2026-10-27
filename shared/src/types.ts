export type MemberRole = 'admin' | 'member'

export type SplitMode = 'equal' | 'percentage' | 'exact' | 'shares'

export type SettlementMethod = 'cash' | 'upi' | 'online'

export type TripMember = {
  uid: string
  name: string
  email: string
  role: MemberRole
  upiId?: string
  photoURL?: string
}

export type Trip = {
  id: string
  name: string
  description?: string
  emoji?: string
  startDate: string
  endDate: string
  currency: string
  budget?: number | null
  createdBy: string
  members: TripMember[]
  memberIds: string[]
  adminIds: string[]
  createdAt?: unknown
  updatedAt?: unknown
}

export type SplitAmongItem = {
  uid: string
  value: number
}

export type Expense = {
  id: string
  title: string
  amount: number
  category: string
  paidBy: string
  date: string
  note?: string
  splitMode: SplitMode
  splitAmong: SplitAmongItem[]
  receiptURL?: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type Settlement = {
  id: string
  from: string
  to: string
  amount: number
  method: SettlementMethod
  settledAt: string
  note?: string
}

export type BalanceEntry = {
  uid: string
  name: string
  email: string
  role: MemberRole
  paid: number
  share: number
  settledIn: number
  settledOut: number
  net: number
}

export type SettlementSuggestion = {
  from: string
  to: string
  amount: number
}

export type Actor = {
  uid: string
  name: string
  email: string
  upiId?: string
}

export type UserProfile = {
  uid: string
  name: string
  email: string
  phone?: string
  photoURL?: string
  upiId?: string
  createdAt?: unknown
}
