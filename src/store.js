import { reactive, watch } from 'vue'
import { addDays, monthKey, todayISO, toISO, uid } from './utils'

const KEY = 'erp-finance-v2'

export const INCOME_CATEGORIES = ['Penjualan Produk', 'Jasa Konsultasi', 'Pendapatan Lain']
export const EXPENSE_CATEGORIES = [
  'Bahan Baku',
  'Gaji Karyawan',
  'Sewa',
  'Utilitas',
  'Marketing',
  'Operasional',
]
export const ACCOUNTS = ['Bank BCA', 'Bank BNI', 'Bank Mandiri', 'Bank BTN', 'GOPAY', 'OVO', ]
export const PRODUCT_CATEGORIES = ['Sparepart', 'Jasa', 'Material', 'Kimia', 'Lainnya']
export const UNITS = ['pcs', 'gr', 'box', 'kg', 'ltr', 'mm', 'ml', 'pail']
export const CRO_LEVELS = ['CRO I', 'CRO II', 'CRO III', 'CRO IV', 'CRO V', 'CRO VI', 'CRO VII', 'CRO VIII', 'CRO IX', 'CRO X']

/* ---------- data demo ---------- */
function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function seedData() {
  const r = rng(7)
  const today = new Date()
  const iso = todayISO()

  const contacts = [
    { id: 'c1', name: 'PT Maju Bersama', type: 'customer', email: 'finance@majubersama.co.id', phone: '021-5551234', city: 'Jakarta' },
    { id: 'c2', name: 'CV Karya Mandiri', type: 'customer', email: 'admin@karyamandiri.id', phone: '022-7781200', city: 'Bandung' },
    { id: 'c3', name: 'Toko Sinar Jaya', type: 'customer', email: 'sinarjaya@gmail.com', phone: '0812-3456-7788', city: 'Surabaya' },
    { id: 'c4', name: 'PT Nusantara Digital', type: 'customer', email: 'ap@nusadigital.com', phone: '021-5207788', city: 'Tangerang' },
    { id: 'c5', name: 'Bu Rina Catering', type: 'customer', email: 'rina.catering@mail.com', phone: '0857-1122-3344', city: 'Bekasi' },
    { id: 'v1', name: 'PT Sumber Makmur', type: 'vendor', email: 'sales@sumbermakmur.co.id', phone: '021-8890011', city: 'Jakarta' },
    { id: 'v2', name: 'CV Global Supplies', type: 'vendor', email: 'order@globalsupplies.id', phone: '031-5003344', city: 'Surabaya' },
    { id: 'v3', name: 'PLN & Utilitas', type: 'vendor', email: 'layanan@pln.example', phone: '123', city: 'Jakarta' },
    { id: 'v4', name: 'Pemilik Gedung Graha', type: 'vendor', email: 'bm@grahaoffice.id', phone: '021-5700123', city: 'Jakarta' },
  ]

  const incDesc = {
    'Penjualan Produk': ['Penjualan retail', 'Penjualan grosir', 'Order online', 'Penjualan toko'],
    'Jasa Konsultasi': ['Konsultasi sistem', 'Implementasi & training', 'Jasa maintenance'],
    'Pendapatan Lain': ['Bunga bank', 'Penjualan aset bekas'],
  }
  const expDesc = {
    'Bahan Baku': ['Pembelian stok barang', 'Restock supplier', 'Pembelian bahan'],
    Marketing: ['Iklan sosial media', 'Cetak brosur', 'Endorse & promo'],
    Utilitas: ['Listrik & air', 'Internet kantor'],
    Operasional: ['ATK kantor', 'Transport & ongkir', 'Perawatan peralatan', 'Konsumsi rapat'],
  }
  const pick = (a) => a[Math.floor(r() * a.length)]
  const transactions = []
  const add = (date, type, category, description, amount) =>
    transactions.push({
      id: uid('t'),
      date: toISO(date),
      type,
      category,
      description,
      amount,
      account: pick(ACCOUNTS),
    })

  for (let m = 5; m >= 0; m--) {
    const first = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const maxDay = m === 0 ? today.getDate() : dim
    const growth = 1 + (5 - m) * 0.06
    const day = (d) => new Date(first.getFullYear(), first.getMonth(), Math.max(1, Math.min(d, maxDay)))

    const nInc = 7 + Math.floor(r() * 4)
    for (let i = 0; i < nInc; i++) {
      const cat = r() < 0.65 ? 'Penjualan Produk' : r() < 0.85 ? 'Jasa Konsultasi' : 'Pendapatan Lain'
      const base = cat === 'Pendapatan Lain' ? 0.4 + r() * 1.2 : 6 + r() * 26
      add(day(1 + Math.floor(r() * maxDay)), 'income', cat, pick(incDesc[cat]), Math.round((base * growth * 1e6) / 1e5) * 1e5)
    }
    const nExp = 6 + Math.floor(r() * 4)
    for (let i = 0; i < nExp; i++) {
      const cat = pick(['Bahan Baku', 'Bahan Baku', 'Marketing', 'Utilitas', 'Operasional', 'Operasional'])
      const base = cat === 'Bahan Baku' ? 8 + r() * 18 : cat === 'Marketing' ? 2 + r() * 5 : 0.8 + r() * 4
      add(day(1 + Math.floor(r() * maxDay)), 'expense', cat, pick(expDesc[cat]), Math.round((base * 1e6) / 1e5) * 1e5)
    }
    add(day(1), 'expense', 'Sewa', 'Sewa kantor bulanan', 12000000)
    if (maxDay >= 25) add(day(25), 'expense', 'Gaji Karyawan', 'Gaji karyawan', 28000000 + Math.round(r() * 2) * 500000)
  }
  transactions.sort((a, b) => b.date.localeCompare(a.date))

  const mk = (n, contactId, issueOff, dueOff, status, items, tax = true) => ({
    id: uid('i'),
    number: `INV-2026-${String(n).padStart(4, '0')}`,
    contactId,
    issueDate: addDays(iso, issueOff),
    dueDate: addDays(iso, dueOff),
    status,
    tax,
    items,
    paidDate: status === 'paid' ? addDays(iso, Math.min(issueOff + 6, 0)) : null,
  })
  const invoices = [
    mk(1, 'c1', -75, -45, 'paid', [{ name: 'Paket implementasi sistem', qty: 1, price: 18500000 }]),
    mk(2, 'c2', -52, -22, 'paid', [{ name: 'Monitor 24"', qty: 6, price: 1850000 }, { name: 'Keyboard & Mouse', qty: 6, price: 350000 }]),
    mk(3, 'c3', -40, -10, 'sent', [{ name: 'Router WiFi', qty: 10, price: 640000 }]),
    mk(4, 'c4', -33, -3, 'sent', [{ name: 'Jasa maintenance bulanan', qty: 3, price: 4500000 }]),
    mk(5, 'c5', -28, 2, 'sent', [{ name: 'Kertas A4 80gsm', qty: 40, price: 52000 }, { name: 'Tinta printer', qty: 12, price: 95000 }]),
    mk(6, 'c1', -20, -5, 'sent', [{ name: 'Konsultasi sistem', qty: 12, price: 750000 }]),
    mk(7, 'c2', -14, 16, 'sent', [{ name: 'Headset', qty: 15, price: 285000 }, { name: 'Webcam', qty: 15, price: 410000 }]),
    mk(8, 'c4', -9, 21, 'paid', [{ name: 'Implementasi & training', qty: 1, price: 14000000 }]),
    mk(9, 'c3', -3, 27, 'sent', [{ name: 'Flashdisk 64GB', qty: 50, price: 78000 }], false),
    mk(10, 'c5', 0, 30, 'draft', [{ name: 'Kabel HDMI', qty: 20, price: 55000 }, { name: 'Router WiFi', qty: 4, price: 640000 }]),
  ]

  const P = (sku, name, category, stock, minStock, cost, price) => ({ id: uid('p'), sku, name, category, stock, minStock, cost, price })
  const products = [
    P('ATK-001', 'Kertas A4 80gsm', 'Alat Tulis', 180, 60, 41000, 52000),
    P('ATK-002', 'Tinta Printer Hitam', 'Alat Tulis', 22, 30, 68000, 95000),
    P('ELK-001', 'Monitor 24"', 'Elektronik', 14, 8, 1450000, 1850000),
    P('ELK-002', 'Headset', 'Elektronik', 35, 15, 190000, 285000),
    P('ELK-003', 'Webcam Full HD', 'Elektronik', 9, 12, 290000, 410000),
    P('AKS-001', 'Keyboard Wireless', 'Aksesoris', 48, 20, 160000, 250000),
    P('AKS-002', 'Mouse Wireless', 'Aksesoris', 62, 25, 75000, 120000),
    P('AKS-003', 'Flashdisk 64GB', 'Aksesoris', 120, 40, 52000, 78000),
    P('JRG-001', 'Router WiFi', 'Jaringan', 6, 10, 480000, 640000),
    P('JRG-002', 'Kabel HDMI 2m', 'Jaringan', 85, 30, 32000, 55000),
  ]

  return { contacts, transactions, invoices, products, settings: defaultSettings() }
}

function defaultSettings() {
  return { company: 'Usaha Saya', taxRate: 11, openingBalance: 50000000, theme: 'light' }
}

/* ---------- state ---------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      // pakai data tersimpan hanya jika strukturnya lengkap
      if (['transactions', 'invoices', 'products', 'contacts'].every((k) => Array.isArray(d[k]))) return d
    }
  } catch {}
  return seedData()
}

export const store = reactive(load())
store.settings = { ...defaultSettings(), ...store.settings }

watch(
  store,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store))
    } catch {}
  },
  { deep: true },
)

/* ---------- toast & confirm ---------- */
export const ui = reactive({ toasts: [], confirm: null })

export function toast(message, type = 'success') {
  const id = uid('toast')
  ui.toasts.push({ id, message, type })
  setTimeout(() => {
    const i = ui.toasts.findIndex((t) => t.id === id)
    if (i > -1) ui.toasts.splice(i, 1)
  }, 3200)
}

export function askConfirm({ title = 'Yakin?', message = '', okText = 'Hapus', danger = true }) {
  return new Promise((resolve) => {
    ui.confirm = {
      title,
      message,
      okText,
      danger,
      resolve: (v) => {
        ui.confirm = null
        resolve(v)
      },
    }
  })
}

/* ---------- CRUD ---------- */
export function save(list, item) {
  const arr = store[list]
  const i = arr.findIndex((x) => x.id === item.id)
  if (i > -1) arr[i] = { ...arr[i], ...item }
  else arr.unshift({ ...item, id: uid(list[0]) })
}
export function remove(list, id) {
  const i = store[list].findIndex((x) => x.id === id)
  if (i > -1) store[list].splice(i, 1)
}
export function resetDemo() {
  const d = seedData()
  Object.keys(d).forEach((k) => (store[k] = d[k]))
}

export function nextInvoiceNumber() {
  const max = store.invoices.reduce((m, i) => Math.max(m, parseInt(i.number.split('-').pop(), 10) || 0), 0)
  return `INV-${new Date().getFullYear()}-${String(max + 1).padStart(4, '0')}`
}

/* ---------- derived helpers ---------- */
export const contactName = (id) => store.contacts.find((c) => c.id === id)?.name ?? '-'

export const invoiceSubtotal = (inv) => inv.items.reduce((s, i) => s + i.qty * i.price, 0)
export const invoiceTax = (inv) => (inv.tax ? Math.round((invoiceSubtotal(inv) * store.settings.taxRate) / 100) : 0)
export const invoiceTotal = (inv) => invoiceSubtotal(inv) + invoiceTax(inv)
export function invoiceStatus(inv) {
  if (inv.status === 'paid' || inv.status === 'draft') return inv.status
  return inv.dueDate < todayISO() ? 'overdue' : 'sent'
}

export function markInvoicePaid(inv, account = 'Bank BCA') {
  inv.status = 'paid'
  inv.paidDate = todayISO()
  store.transactions.unshift({
    id: uid('t'),
    date: todayISO(),
    type: 'income',
    category: 'Penjualan Produk',
    description: `Pembayaran ${inv.number} - ${contactName(inv.contactId)}`,
    amount: invoiceTotal(inv),
    account,
    invoiceId: inv.id,
  })
}

export function lastMonthKeys(n) {
  const now = new Date()
  const keys = []
  for (let i = n - 1; i >= 0; i--) keys.push(monthKey(toISO(new Date(now.getFullYear(), now.getMonth() - i, 1))))
  return keys
}

export function monthlyTotals(keys) {
  const income = keys.map(() => 0)
  const expense = keys.map(() => 0)
  for (const t of store.transactions) {
    const i = keys.indexOf(monthKey(t.date))
    if (i > -1) (t.type === 'income' ? income : expense)[i] += t.amount
  }
  return { income, expense }
}

export function categoryTotals(type, keys) {
  const map = {}
  for (const t of store.transactions) {
    if (t.type !== type || !keys.includes(monthKey(t.date))) continue
    map[t.category] = (map[t.category] || 0) + t.amount
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function balance() {
  return (
    store.settings.openingBalance +
    store.transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
  )
}
