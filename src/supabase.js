/*
 * Klien Supabase minimal (tanpa library tambahan): login + baca/tulis tabel lewat REST.
 * URL dan publishable key di bawah memang boleh publik (keamanan ada di aturan akses database).
 * JANGAN PERNAH menaruh secret key / service_role di file ini.
 */
export const SUPABASE_URL = 'https://bxchpkqjqaiomkybnipa.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_Pk1bS2BaG_p6zBPbFv47XQ_Sc2BsRCK'

const SESSION_KEY = 'erp-sb-session'
let session = null
let refreshing = null

try {
  session = JSON.parse(localStorage.getItem(SESSION_KEY))
} catch {}

const persist = () => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}

const baseHeaders = () => ({ apikey: SUPABASE_KEY, 'Content-Type': 'application/json' })

function errMessage(body, status) {
  const m = body?.msg || body?.message || body?.error_description || body?.error || ''
  if (/invalid login|invalid_credentials/i.test(m + (body?.error_code || ''))) return 'Email atau password salah.'
  if (/email not confirmed/i.test(m)) return 'Akun belum dikonfirmasi. Hubungi Pemilik.'
  if (status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'
  return m || `Permintaan gagal (${status}).`
}

async function tokenRequest(body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${body.grant}`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(body.payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = new Error(errMessage(data, res.status))
    e.status = res.status
    throw e
  }
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: { id: data.user.id, email: data.user.email },
  }
  persist()
  return session
}

export const getSession = () => session

export async function signIn(email, password) {
  return tokenRequest({ grant: 'password', payload: { email: email.trim(), password } })
}

async function refresh() {
  if (!session?.refresh_token) throw new Error('Sesi berakhir. Silakan masuk lagi.')
  if (!refreshing) {
    refreshing = tokenRequest({ grant: 'refresh_token', payload: { refresh_token: session.refresh_token } })
      .catch((e) => {
        // refresh token ditolak = sesi memang habis; jangan hapus sesi jika cuma gangguan jaringan
        if (e.status === 400 || e.status === 401) {
          session = null
          persist()
        }
        throw e
      })
      .finally(() => (refreshing = null))
  }
  return refreshing
}

async function token() {
  if (!session) throw new Error('Belum masuk.')
  if (session.expires_at - 60 < Date.now() / 1000) await refresh()
  return session.access_token
}

export async function signOut() {
  const t = session?.access_token
  session = null
  persist()
  if (t) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { ...baseHeaders(), Authorization: `Bearer ${t}` } })
    } catch {}
  }
}

/** Panggilan ke tabel (PostgREST). path contoh: 'products?select=id,data' */
export async function api(path, { method = 'GET', body, prefer, headers = {} } = {}, retry = true) {
  const t = await token()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...baseHeaders(), Authorization: `Bearer ${t}`, ...(prefer ? { Prefer: prefer } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401 && retry) {
    await refresh()
    return api(path, { method, body, prefer, headers }, false)
  }
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {}
  if (!res.ok) {
    const e = new Error(data?.message || data?.hint || `Gagal (${res.status})`)
    e.status = res.status
    throw e
  }
  return data
}

/** Baca semua baris (mengambil per 1000 baris sampai habis). */
export async function selectAll(table, columns = 'id,data') {
  const out = []
  for (let from = 0; ; from += 1000) {
    let rows
    try {
      rows = await api(`${table}?select=${columns}&order=id.desc`, { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
    } catch (e) {
      if (e.status === 416 && from > 0) break // halaman berikutnya kosong
      throw e
    }
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

export async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => ({ id: r.id, data: r.data, updated_at: new Date().toISOString() }))
    await api(`${table}?on_conflict=id`, { method: 'POST', body: chunk, prefer: 'resolution=merge-duplicates,return=minimal' })
  }
}

export async function removeIds(table, ids) {
  for (let i = 0; i < ids.length; i += 40) {
    const list = ids.slice(i, i + 40).map((x) => `"${String(x).replace(/"/g, '')}"`).join(',')
    await api(`${table}?id=in.(${encodeURIComponent(list)})`, { method: 'DELETE', prefer: 'return=minimal' })
  }
}
