import { store, ACCOUNTS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, PRODUCT_CATEGORIES, UNITS, CRO_LEVELS, PKS_LIST } from './store'
import { uid } from './utils'

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (v) => String(v ?? '').trim()

function toNumber(v) {
  if (typeof v === 'number') return v
  let s = text(v).replace(/rp\.?|idr|\s/gi, '')
  if (!s) return NaN
  let neg = false
  if (/^\(.*\)$/.test(s) || s.startsWith('-')) {
    neg = true
    s = s.replace(/[()-]/g, '')
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? NaN : neg ? -n : n
}

function toDate(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
  const s = text(v)
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  let y, mo, d
  if (m) [, y, mo, d] = m
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) [, d, mo, y] = m
  else return null
  y = String(y).length === 2 ? '20' + y : y
  const dt = new Date(+y, +mo - 1, +d)
  if (dt.getFullYear() !== +y || dt.getMonth() !== +mo - 1 || dt.getDate() !== +d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const matchList = (v, list) => list.find((x) => norm(x) === norm(v))
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
function toCro(v) {
  const s = text(v).toUpperCase().replace(/^CRO[\s-]*/, '').trim()
  if (!s) return ''
  const i = /^\d+$/.test(s) ? Number(s) - 1 : ROMAN.indexOf(s)
  return i >= 0 && i < CRO_LEVELS.length ? CRO_LEVELS[i] : null
  const prodKey = (p) => [p.name, p.sku, p.cro || '', p.pks || ''].join('|').toLowerCase()
}
/* ---------- skema per jenis data ---------- */
export const SCHEMAS = {
  transactions: {
    label: 'Transaksi',
    columns: {
      date: { label: 'Tanggal', aliases: ['tanggal', 'date', 'tgl'], required: true },
      type: { label: 'Jenis', aliases: ['jenis', 'tipe', 'type'] },
      category: { label: 'Kategori', aliases: ['kategori', 'category'] },
      description: { label: 'Keterangan', aliases: ['keterangan', 'deskripsi', 'description', 'uraian'], required: true },
      account: { label: 'Akun', aliases: ['akun', 'account', 'rekening'] },
      amount: { label: 'Jumlah', aliases: ['jumlah', 'nominal', 'amount', 'nilai', 'total'], required: true },
    },
    sample: [
      ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Akun', 'Jumlah'],
      ['2026-10-01', 'Pemasukan', 'Penjualan Produk', 'Penjualan grosir', 'Bank BCA', 1500000],
      ['2026-10-02', 'Pengeluaran', 'Operasional', 'Beli ATK kantor', 'Kas', 250000],
    ],
    hint: 'Jenis: Pemasukan / Pengeluaran (kalau kosong, jumlah negatif dianggap pengeluaran).',
    row(r, ctx) {
      const errors = []
      const warnings = []
      const date = toDate(r.date)
      if (!date) errors.push('Tanggal tidak valid')
      let amount = toNumber(r.amount)
      if (isNaN(amount) || amount === 0) errors.push('Jumlah tidak valid')
      const t = norm(r.type)
      let type = ['pemasukan', 'income', 'masuk', 'in', 'pendapatan', 'kredit'].includes(t) ? 'income' : ['pengeluaran', 'expense', 'keluar', 'out', 'beban', 'biaya', 'debit'].includes(t) ? 'expense' : null
      if (!type && t) errors.push('Jenis harus Pemasukan atau Pengeluaran')
      if (!type) type = amount < 0 ? 'expense' : 'income'
      amount = Math.abs(amount)
      const description = text(r.description)
      if (!description) errors.push('Keterangan kosong')
      const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
      let category = matchList(r.category, cats)
      if (!category) {
        category = type === 'income' ? 'Pendapatan Lain' : 'Operasional'
        if (text(r.category)) warnings.push(`Kategori "${text(r.category)}" tidak dikenal → ${category}`)
      }
      let account = matchList(r.account, ACCOUNTS)
      if (!account) {
        account = ACCOUNTS[0]
        if (text(r.account)) warnings.push(`Akun "${text(r.account)}" tidak dikenal → ${account}`)
      }
      const item = { id: uid('t'), date, type, category, description, amount, account }
      const key = [date, type, amount, norm(description)].join('|')
      if (!errors.length && (ctx.seen.has(key) || store.transactions.some((x) => [x.date, x.type, x.amount, norm(x.description)].join('|') === key))) return { item, skip: 'Duplikat, dilewati' }
      ctx.seen.add(key)
      return { item, errors, warnings }
    },
    commit(items) {
      store.transactions.unshift(...items)
      store.transactions.sort((a, b) => b.date.localeCompare(a.date))
      return { added: items.length, updated: 0 }
    },
    preview: (i) => [i.date, i.type === 'income' ? 'Pemasukan' : 'Pengeluaran', i.description, i.amount.toLocaleString('id-ID')],
    previewHead: ['Tanggal', 'Jenis', 'Keterangan', 'Jumlah'],
  },

    products: {
    label: 'Produk',
      xlsx: { center: true, money: [7, 8] },
    columns: {
      name: { label: 'Nama', aliases: ['nama', 'namaproduk', 'produk', 'name', 'namabarang'], required: true },
      sku: { label: 'SKU', aliases: ['sku', 'kode', 'kodebarang'], required: true },
      category: { label: 'Kategori', aliases: ['kategori', 'category'] },
      cro: { label: 'CRO', aliases: ['cro'] },
      pks: { label: 'PKS', aliases: ['pks', 'namapks'] },
      stock: { label: 'Stok', aliases: ['stok', 'stock', 'qty', 'jumlah'] },
      unit: { label: 'Satuan', aliases: ['satuan', 'unit', 'uom'] },
      price: { label: 'Harga Satuan', aliases: ['hargasatuan', 'harga', 'hargajual', 'price'] },
      total: { label: 'Harga Total', aliases: ['hargatotal', 'total'] },
    },
    sample: [
      ['Nama', 'SKU', 'Kategori', 'CRO', 'PKS', 'Stok', 'Satuan', 'Harga Satuan', 'Harga Total'],
      ['Eksternal', 'Contoh Barang A', 'Kimia', 'CRO I', 'CSB', 100, 'kg', 10000, 1000000],
      ['Eksternal', 'Contoh Barang B', 'Material', 'CRO II', 'DPN', 50, 'pcs', 25000, 1250000],
    ],
    hint: 'Data dengan SKU + CRO + PKS yang sama akan diperbarui, selain itu ditambahkan. Harga Total dihitung otomatis (stok × harga satuan).',
    row(r, ctx) {
      const errors = []
      const warnings = []
      const sku = text(r.sku)
      const name = text(r.name)
      if (!sku) errors.push('SKU kosong')
      if (!name) errors.push('Nama kosong')
      const n = (v, label) => {
        if (text(v) === '') return null
        const x = toNumber(v)
        if (isNaN(x) || x < 0) {
          errors.push(`${label} tidak valid`)
          return null
        }
        return x
      }
      const stock = n(r.stock, 'Stok') ?? 0
      let price = n(r.price, 'Harga satuan')
      const total = n(r.total, 'Harga total')
      if (price === null) price = total !== null && stock > 0 ? Math.round(total / stock) : 0
      let category = matchList(r.category, PRODUCT_CATEGORIES)
      if (!category) {
        category = PRODUCT_CATEGORIES.at(-1)
        if (text(r.category)) warnings.push(`Kategori "${text(r.category)}" tidak dikenal → ${category}`)
      }
      const unit = matchList(r.unit, UNITS) || UNITS[0]
      if (text(r.unit) && !matchList(r.unit, UNITS)) warnings.push(`Satuan "${text(r.unit)}" tidak dikenal → ${unit}`)
      let cro = toCro(r.cro)
      if (cro === null) {
        warnings.push(`CRO "${text(r.cro)}" tidak dikenal → dikosongkan`)
        cro = ''
      }
      const pks = matchList(r.pks, PKS_LIST) || ''
      if (text(r.pks) && !pks) warnings.push(`PKS "${text(r.pks)}" tidak dikenal → dikosongkan`)
      const key = prodKey({ name, sku, cro, pks })
      if (sku && ctx.seen.has(key)) return { item: null, skip: 'Baris dobel di file (SKU + CRO + PKS sama), dilewati' }
      ctx.seen.add(key)
      const exists = store.products.some((p) => prodKey(p) === key)
      if (exists) warnings.push('Sudah ada → diperbarui')
      return { item: { sku, name, category, cro, pks, stock, unit, price }, errors, warnings }
    },
    commit(items) {
      let added = 0
      let updated = 0
      for (const it of items) {
        const key = prodKey(it)
        const ex = store.products.find((p) => prodKey(p) === key)
        if (ex) (Object.assign(ex, it), updated++)
        else (store.products.unshift({ id: uid('p'), minStock: 10, ...it }), added++)
      }
      return { added, updated }
    },
    preview: (i) => [i.sku, i.name, i.cro || '-', i.pks || '-', i.stock, i.price.toLocaleString('id-ID')],
    previewHead: ['SKU', 'Nama', 'CRO', 'PKS', 'Stok', 'Harga satuan'],
  },

  contacts: {
    label: 'Kontak',
    columns: {
      name: { label: 'Nama', aliases: ['nama', 'name'], required: true },
      type: { label: 'Tipe', aliases: ['tipe', 'jenis', 'type'] },
      email: { label: 'Email', aliases: ['email', 'surel'] },
      phone: { label: 'Telepon', aliases: ['telepon', 'telp', 'hp', 'phone', 'nohp'] },
      city: { label: 'Kota', aliases: ['kota', 'city'] },
    },
    sample: [
      ['Nama', 'Tipe', 'Email', 'Telepon', 'Kota', 'Satuan'],
      ['PT Contoh Abadi', 'Pelanggan', 'info@contoh.co.id', '021-5550000', 'Jakarta', 'box'],
      ['CV Supplier Jaya', 'Vendor', 'order@supplier.id', '0812-0000-1111', 'Bandung', 'pcs'],
    ],
    hint: 'Tipe: Pelanggan / Vendor (kosong = Pelanggan). Nama + tipe yang sudah ada dilewati.',
    row(r, ctx) {
      const errors = []
      const name = text(r.name)
      if (!name) errors.push('Nama kosong')
      const t = norm(r.type)
      let type = ['pelanggan', 'customer', 'klien', ''].includes(t) ? 'customer' : ['vendor', 'supplier', 'pemasok'].includes(t) ? 'vendor' : null
      if (!type) {
        errors.push('Tipe harus Pelanggan atau Vendor')
        type = 'customer'
      }
      const key = norm(name) + '|' + type
      const item = { name, type, email: text(r.email), phone: text(r.phone), city: text(r.city) }
      if (!errors.length && (ctx.seen.has(key) || store.contacts.some((c) => norm(c.name) + '|' + c.type === key))) return { item, skip: 'Sudah ada, dilewati' }
      ctx.seen.add(key)
      return { item, errors, warnings: [] }
    },
    commit(items) {
      store.contacts.unshift(...items.map((i) => ({ id: uid('c'), ...i })))
      return { added: items.length, updated: 0 }
    },
    preview: (i) => [i.name, i.type === 'customer' ? 'Pelanggan' : 'Vendor', i.email, i.city],
    previewHead: ['Nama', 'Tipe', 'Email', 'Kota'],
  },
}

/* ---------- baca tabel -> hasil validasi ---------- */
export function parseTable(kind, table) {
  const schema = SCHEMAS[kind]
  const entries = Object.entries(schema.columns)

  // cari baris header (10 baris pertama) dengan kecocokan alias terbanyak
  let best = { idx: -1, score: 0, map: {} }
  table.slice(0, 10).forEach((row, idx) => {
    const map = {}
    row.forEach((cell, ci) => {
      const n = norm(cell)
      if (!n) return
      for (const [key, col] of entries) if (!(key in map) && (col.aliases.includes(n) || norm(col.label) === n)) map[key] = ci
    })
    const score = Object.keys(map).length
    if (score > best.score) best = { idx, score, map }
  })

  const missing = entries.filter(([k, c]) => c.required && !(k in best.map)).map(([, c]) => c.label)
  if (best.idx < 0 || missing.length) return { items: [], missing: missing.length ? missing : entries.filter(([, c]) => c.required).map(([, c]) => c.label), headerFound: best.idx >= 0 }

  const ctx = { seen: new Set() }
  const items = []
  table.slice(best.idx + 1).forEach((row, i) => {
    if (!row || row.every((c) => text(c) === '')) return
    const rec = {}
    for (const key of Object.keys(schema.columns)) rec[key] = key in best.map ? row[best.map[key]] : ''
    const res = schema.row(rec, ctx)
    const line = best.idx + i + 2
    if (res.skip) items.push({ line, status: 'skip', message: res.skip, item: res.item })
    else if (res.errors.length) items.push({ line, status: 'error', message: res.errors.join('; '), item: res.item })
    else items.push({ line, status: res.warnings.length ? 'warn' : 'ok', message: res.warnings.join('; '), item: res.item })
  })
  return { items, missing: [], headerFound: true }
}

export const commitImport = (kind, items) => SCHEMAS[kind].commit(items)
