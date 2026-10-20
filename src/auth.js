import { computed, reactive, watch } from 'vue'
import { uid } from './utils'

/*
 * CATATAN KEAMANAN
 * Login ini berjalan sepenuhnya di browser (data di localStorage), jadi cocok untuk demo /
 * pemakaian pribadi di satu perangkat. Siapa pun yang bisa membuka DevTools bisa melewatinya.
 * Untuk produksi, pindahkan verifikasi ke backend (mis. JWT/session cookie) dan simpan password di server.
 */

// ---------- SHA-256 sinkron (murni JS, jalan di http maupun https) ----------
const primes = []
for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n)
const frac = (x) => Math.floor((x - Math.floor(x)) * 2 ** 32)
const K = primes.map((p) => frac(Math.cbrt(p)))
const H0 = primes.slice(0, 8).map((p) => frac(Math.sqrt(p)))
const rotr = (x, n) => (x >>> n) | (x << (32 - n))

export function sha256(str) {
  const bytes = [...new TextEncoder().encode(str)]
  const bits = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const hi = Math.floor(bits / 2 ** 32)
  const lo = bits >>> 0
  for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 255)
  for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 255)
  const h = [...H0]
  for (let o = 0; o < bytes.length; o += 64) {
    const w = new Array(64)
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3]
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    ;[a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) | 0))
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

const hashPw = (username, password) => sha256(`erp:${username.toLowerCase()}:${password}`)

// ---------- state ----------
const KEY = 'erp-auth-v1'
export const ROLES = { owner: 'Pemilik', cashier: 'Kasir' }

const seed = () => ({
  users: [
    { id: 'u1', username: 'admin', name: 'Admin', role: 'owner', hash: hashPw('admin', 'admin123') },
    { id: 'u2', username: 'kasir', name: 'Kasir', role: 'cashier', hash: hashPw('kasir', 'kasir123') },
  ],
  session: null,
  attempts: 0,
  lockUntil: 0,
})

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (d && Array.isArray(d.users) && d.users.length) return { attempts: 0, lockUntil: 0, session: null, ...d }
  } catch {}
  return seed()
}

export const auth = reactive(load())
watch(auth, () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(auth))
  } catch {}
}, { deep: true })

export const user = computed(() => auth.users.find((u) => u.id === auth.session) || null)
export const isOwner = computed(() => user.value?.role === 'owner')

// ---------- aksi ----------
export function login(username, password) {
  const now = Date.now()
  if (auth.lockUntil > now) return { ok: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((auth.lockUntil - now) / 1000)} detik.` }
  const u = auth.users.find((x) => x.username === username.trim().toLowerCase())
  if (u && u.hash === hashPw(u.username, password)) {
    auth.session = u.id
    auth.attempts = 0
    return { ok: true }
  }
  auth.attempts++
  if (auth.attempts >= 5) {
    auth.attempts = 0
    auth.lockUntil = now + 30000
    return { ok: false, error: 'Terlalu banyak percobaan. Dikunci selama 30 detik.' }
  }
  return { ok: false, error: 'Username atau password salah.' }
}

export const logout = () => (auth.session = null)

export function changePassword(oldPw, newPw) {
  const u = user.value
  if (!u || u.hash !== hashPw(u.username, oldPw)) return 'Password lama salah.'
  if (newPw.length < 6) return 'Password baru minimal 6 karakter.'
  u.hash = hashPw(u.username, newPw)
  return null
}

export function addUser({ name, username, password, role }) {
  username = username.trim().toLowerCase()
  if (!name.trim() || !username) return 'Nama dan username wajib diisi.'
  if (!/^[a-z0-9._-]{3,}$/.test(username)) return 'Username minimal 3 karakter (huruf, angka, . _ -).'
  if (password.length < 6) return 'Password minimal 6 karakter.'
  if (auth.users.some((u) => u.username === username)) return 'Username sudah dipakai.'
  auth.users.push({ id: uid('u'), username, name: name.trim(), role, hash: hashPw(username, password) })
  return null
}

export function removeUser(id) {
  if (id === auth.session) return 'Tidak bisa menghapus akun yang sedang dipakai.'
  const owners = auth.users.filter((u) => u.role === 'owner')
  if (owners.length === 1 && owners[0].id === id) return 'Harus ada minimal satu Pemilik.'
  auth.users.splice(auth.users.findIndex((u) => u.id === id), 1)
  return null
}

// username ikut dipakai dalam hash password, jadi mengganti username wajib konfirmasi password
export function updateProfile({ name, username, password }) {
  const u = user.value
  username = username.trim().toLowerCase()
  if (!name.trim()) return 'Nama tampilan wajib diisi.'
  if (!/^[a-z0-9._-]{3,}$/.test(username)) return 'Username minimal 3 karakter (huruf, angka, . _ -).'
  if (u.hash !== hashPw(u.username, password)) return 'Password salah.'
  if (auth.users.some((x) => x.username === username && x.id !== u.id)) return 'Username sudah dipakai.'
  u.name = name.trim()
  u.username = username
  u.hash = hashPw(username, password)
  return null
}
