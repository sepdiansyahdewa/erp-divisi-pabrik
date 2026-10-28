/*
 * Sinkronisasi data aplikasi <-> Supabase.
 * - Saat masuk: data diambil dari cloud ke `store`.
 * - Pemilik: setiap perubahan di `store` otomatis disimpan ke cloud (hanya bagian yang berubah).
 * - Hanya-lihat: perubahan apa pun dibatalkan (dan database juga menolaknya).
 * - Data lama di browser (kunci 'erp-finance-v2') tidak pernah ditimpa; bisa diunggah sekali lewat tombol.
 */
import { reactive, watch } from 'vue'
import { store, toast } from './store'
import { api, selectAll, upsert, removeIds } from './supabase'

export const TABLES = ['products', 'transactions', 'contacts', 'invoices']
export const sync = reactive({ state: 'idle', error: '', last: null, canWrite: false, legacy: null })

const LEGACY_KEY = 'erp-finance-v2'
const LEGACY_DONE = 'erp-legacy-done'
const POLL_MS = 30000

let snap = null // gambaran data cloud terakhir: { tabel: Map(id -> json), settings: json }
let active = false
let dirty = false
let pushing = false
let timer = null
let retry = null
let poller = null

// JSON dengan urutan kunci tetap, supaya perbandingan tidak terkecoh urutan properti
const canon = (v) =>
  JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x))
const mapOf = (list) => new Map(list.map((x) => [x.id, canon(x)]))
const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v)
const settingsData = () => {
  const { theme, ...rest } = store.settings // tema disimpan per perangkat, bukan di cloud
  return rest
}

const ORDER = {
  products: (a, b) => String(a.name).localeCompare(String(b.name)) || String(a.sku).localeCompare(String(b.sku)),
  contacts: (a, b) => String(a.name).localeCompare(String(b.name)),
  transactions: (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)),
  invoices: (a, b) => String(b.number).localeCompare(String(a.number)),
}

function takeSnapshot() {
  snap = { settings: canon(settingsData()) }
  for (const t of TABLES) snap[t] = mapOf(store[t])
}

/* ---------- ambil dari cloud ---------- */
export async function pull({ force = false } = {}) {
  if (!force && (dirty || pushing)) return false
  const rows = await Promise.all(TABLES.map((t) => selectAll(t)))
  const srows = await api('settings?select=id,data&id=eq.main')
  const next = {}
  TABLES.forEach((t, i) => (next[t] = rows[i].map((r) => ({ ...r.data, id: r.id })).sort(ORDER[t])))
  const cloudSettings = srows[0]?.data || null

  const changed =
    !snap ||
    TABLES.some((t) => !sameMap(snap[t], mapOf(next[t]))) ||
    (cloudSettings && canon(cloudSettings) !== snap.settings)
  if (changed) {
    TABLES.forEach((t) => (store[t] = next[t]))
    if (cloudSettings) store.settings = { ...store.settings, ...cloudSettings }
    takeSnapshot()
  }
  sync.last = Date.now()
  return changed
}

/* ---------- kirim ke cloud ---------- */
function collect() {
  const out = { tables: {}, settings: null, any: false }
  for (const t of TABLES) {
    const cur = mapOf(store[t])
    const old = snap[t]
    const up = []
    const del = []
    for (const [id, j] of cur) if (old.get(id) !== j) up.push({ id, data: JSON.parse(j) })
    for (const id of old.keys()) if (!cur.has(id)) del.push(id)
    if (up.length || del.length) {
      out.tables[t] = { up, del, cur }
      out.any = true
    }
  }
  const s = canon(settingsData())
  if (s !== snap.settings) {
    out.settings = { str: s, data: JSON.parse(s) }
    out.any = true
  }
  return out
}

function schedule() {
  if (!active || !snap) return
  clearTimeout(timer)
  timer = setTimeout(flush, 500)
}

async function revertToCloud(message) {
  dirty = false
  if (message) toast(message, 'error')
  try {
    await pull({ force: true })
  } catch {}
}

async function flush() {
  if (!active || !snap) return
  if (pushing) return schedule()
  const d = collect()
  if (!d.any) {
    dirty = false
    return
  }
  if (!sync.canWrite) return revertToCloud('Akun ini hanya bisa melihat data. Perubahan dibatalkan.')

  // pengaman: hapus massal harus dikonfirmasi
  const deletes = Object.values(d.tables).reduce((n, x) => n + x.del.length, 0)
  const total = TABLES.reduce((n, t) => n + snap[t].size, 0)
  if (deletes >= 20 && deletes >= total / 2 && !window.confirm(`Ini akan menghapus ${deletes} data dari cloud untuk semua pengguna. Lanjutkan?`)) {
    return revertToCloud('Penghapusan dibatalkan.')
  }

  dirty = true
  pushing = true
  sync.state = 'saving'
  try {
    for (const [t, x] of Object.entries(d.tables)) {
      if (x.up.length) await upsert(t, x.up)
      if (x.del.length) await removeIds(t, x.del)
      snap[t] = x.cur
    }
    if (d.settings) {
      await upsert('settings', [{ id: 'main', data: d.settings.data }])
      snap.settings = d.settings.str
    }
    sync.state = 'saved'
    sync.error = ''
    sync.last = Date.now()
  } catch (e) {
    pushing = false
    if (e.status === 401 || e.status === 403 || /row-level security/i.test(e.message)) {
      sync.canWrite = false
      return revertToCloud('Tidak punya izin mengubah data.')
    }
    sync.state = 'error'
    sync.error = e.message || 'Gagal menyimpan'
    clearTimeout(retry)
    retry = setTimeout(flush, 10000)
    return
  }
  pushing = false
  dirty = collect().any
  if (dirty) schedule()
}

watch(
  () => [store.products, store.transactions, store.contacts, store.invoices, store.settings],
  () => {
    if (!active || !snap) return
    dirty = true
    schedule()
  },
  { deep: true },
)

/* ---------- mulai / berhenti ---------- */
const onVisible = () => {
  if (document.visibilityState === 'visible') pull().catch(() => {})
}

export async function startSync(canWrite) {
  sync.canWrite = canWrite
  sync.state = 'loading'
  snap = null
  readLegacy()
  await pull({ force: true })
  active = true
  dirty = false
  sync.state = 'saved'
  clearInterval(poller)
  poller = setInterval(() => pull().catch(() => {}), POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
}

export function stopSync() {
  active = false
  snap = null
  dirty = false
  pushing = false
  clearTimeout(timer)
  clearTimeout(retry)
  clearInterval(poller)
  document.removeEventListener('visibilitychange', onVisible)
  TABLES.forEach((t) => (store[t] = []))
  sync.state = 'idle'
  sync.legacy = null
  sync.canWrite = false
}

/* ---------- data lama di browser ini ---------- */
function legacyData() {
  try {
    const d = JSON.parse(localStorage.getItem(LEGACY_KEY))
    if (d && TABLES.some((t) => Array.isArray(d[t]) && d[t].length)) return d
  } catch {}
  return null
}

export function readLegacy() {
  const d = legacyData()
  let done = false
  try {
    done = localStorage.getItem(LEGACY_DONE) === '1'
  } catch {}
  sync.legacy = d && !done ? Object.fromEntries(TABLES.map((t) => [t, (d[t] || []).length])) : null
}

export const legacyBackup = () => JSON.stringify(legacyData() || {}, null, 2)

export async function uploadLegacy() {
  if (!sync.canWrite) throw new Error('Hanya Pemilik yang bisa mengunggah data.')
  const d = legacyData()
  if (!d) throw new Error('Tidak ada data lama di browser ini.')
  sync.state = 'saving'
  try {
    for (const t of TABLES) {
      const rows = (d[t] || []).filter((x) => x && x.id).map((x) => ({ id: String(x.id), data: { ...x, id: String(x.id) } }))
      if (rows.length) await upsert(t, rows)
    }
    if (d.settings) {
      const { theme, ...rest } = d.settings
      await upsert('settings', [{ id: 'main', data: rest }])
    }
    try {
      localStorage.setItem(LEGACY_DONE, '1')
    } catch {}
    sync.legacy = null
    await pull({ force: true })
    sync.state = 'saved'
  } catch (e) {
    sync.state = 'error'
    sync.error = e.message
    throw e
  }
}
