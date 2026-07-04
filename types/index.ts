import type {
  StoreUser,
  Product,
  Sale,
  SaleItem,
  Payment,
  Shift,
  Customer,
  Supplier,
  SupplierInvoice,
  SupplierInvoiceItem,
  SupplierPayment,
  InventoryMovement,
  Category,
  Store,
  Branch,
  Plan,
  PlanPrice,
  Subscription,
  StoreType,
} from '@prisma/client'

export type {
  StoreUser,
  Product,
  Sale,
  SaleItem,
  Payment,
  Shift,
  Customer,
  Supplier,
  SupplierInvoice,
  SupplierInvoiceItem,
  SupplierPayment,
  InventoryMovement,
  Category,
  Store,
  Branch,
  Plan,
  PlanPrice,
  Subscription,
  StoreType,
}

// ─── Enum-like string literals (SQLite doesn't support native enums) ─────────

export type BillingCycle       = 'MONTHLY' | 'YEARLY'
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'
export type StoreUserRole      = 'STORE_MANAGER' | 'CASHIER'
export type SaleType           = 'CASH' | 'CREDIT'
export type SaleStatus         = 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
export type ShiftStatus        = 'OPEN' | 'CLOSED'
export type PaymentMethod      = 'CASH' | 'CREDIT' | 'TRANSFER'
export type InvoiceStatus      = 'PAID' | 'PARTIAL' | 'UNPAID'
export type MovementType       = 'IN' | 'OUT' | 'ADJUSTMENT'
export type DiscountType       = 'PERCENTAGE' | 'FIXED'

// ─── Extended types with relations ──────────────────────────────────────────

export type ProductWithCategory = Product & {
  category: Category | null
}

export type SaleWithDetails = Sale & {
  items:    (SaleItem & { product: Product })[]
  customer: Customer | null
  user:     StoreUser
  shift:    Shift
  payments: Payment[]
  branch:   Branch
}

export type ShiftWithUser = Shift & {
  user:   StoreUser
  sales:  Sale[]
  branch: Branch
}

export type SupplierInvoiceWithDetails = SupplierInvoice & {
  items:    (SupplierInvoiceItem & { product: Product })[]
  supplier: Supplier
  payments: SupplierPayment[]
}

export type CustomerWithSales = Customer & {
  sales: Sale[]
}

export type SupplierWithInvoices = Supplier & {
  invoices: SupplierInvoice[]
}

export type StoreWithRelations = Store & {
  storeType:    StoreType
  subscription: Subscription | null
  branches:     Branch[]
}

export type PlanWithPrices = Plan & {
  prices: PlanPrice[]
}

// ─── Cart types ──────────────────────────────────────────────────────────────

export interface CartItem {
  productId:    string
  name:         string
  barcode?:     string
  quantity:     number
  unitPrice:    number
  discount:     number
  discountType: DiscountType
  total:        number
  stock:        number
}

export interface CartState {
  items:       CartItem[]
  customerId?: string
  type:        SaleType
  discount:    number
  tax:         number
  subtotal:    number
  total:       number
  amountPaid:  number
  change:      number
}

// ─── API response types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success:  boolean
  data?:    T
  error?:   string
  message?: string
}

export interface PaginatedResponse<T> {
  data:  T[]
  total: number
  page:  number
  limit: number
}
