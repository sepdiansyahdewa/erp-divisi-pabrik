const pad = (n) => String(n).padStart(2, '0')
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0)

export const compact = (n) => {
  const abs = Math.abs(n || 0)
  const sign = n < 0 ? '-' : ''
  const f = (v, s) => sign + (Math.round(v * 10) / 10).toString().replace('.', ',') + ' ' + s
  if (abs >= 1e9) return f(abs / 1e9, 'M')
  if (abs >= 1e6) return f(abs / 1e6, 'jt')
  if (abs >= 1e3) return f(abs / 1e3, 'rb')
  return sign + abs
}

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const addDays = (iso, days) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}
export const fmtDate = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-'
export const monthKey = (iso) => iso.slice(0, 7)
export const monthShort = (key) => BULAN[+key.slice(5, 7) - 1]
export const monthLong = (key) =>
  new Date(key + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

export const initials = (name = '') =>
  name
    .replace(/^(PT|CV|UD|Toko)\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export const uid = (p = 'id') => p + Math.random().toString(36).slice(2, 9)

export const downloadFile = (name, content, type = 'text/csv') => {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const toCSV = (rows) =>
  rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
