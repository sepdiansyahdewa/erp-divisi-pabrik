import { computed, reactive } from 'vue'
import { api, getSession, signIn, signOut } from './supabase'
import { startSync, stopSync } from './sync'

/*
 * Login memakai akun Supabase (email + password). Peran diambil dari tabel `profiles`:
 *   owner  = Pemilik (boleh melihat dan mengubah data)
 *   viewer = hanya melihat
 * Pembatasan sebenarnya dijaga oleh database (RLS), bukan hanya oleh tampilan ini.
 */
export const ROLES = { owner: 'Pemilik', viewer: 'Hanya lihat' }

// `users` berisi akun yang sedang masuk (dipertahankan agar halaman Pengaturan tetap bisa dibuka)
export const auth = reactive({ users: [], session: null })
export const user = computed(() => auth.users.find((u) => u.id === auth.session) || null)
export const isOwner = computed(() => user.value?.role === 'owner')

async function enter(sess) {
  const rows = await api(`profiles?select=name,role&id=eq.${encodeURIComponent(sess.user.id)}`)
  const role = rows[0]?.role === 'owner' ? 'owner' : 'viewer'
  const email = sess.user.email || ''
  const raw = rows[0]?.name || ''
  const name = !raw || raw.includes('@') ? email.split('@')[0] : raw
  await startSync(role === 'owner') // data dimuat dulu supaya halaman tidak sempat tampil kosong
  auth.users = [{ id: sess.user.id, username: email, email, name, role }]
  auth.session = sess.user.id
}

/** Dipanggil sekali sebelum aplikasi tampil: pulihkan sesi yang tersimpan. */
export async function initAuth() {
  const s = getSession()
  if (!s) return
  try {
    await enter(s)
  } catch (e) {
    if (e.status === 400 || e.status === 401) await signOut()
  }
}

export async function login(email, password) {
  try {
    const sess = await signIn(email, password)
    await enter(sess)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Gagal masuk. Coba lagi.' }
  }
}

export async function logout() {
  auth.session = null
  auth.users = []
  stopSync()
  await signOut()
}

// Pengelolaan akun dipindah ke dashboard Supabase (Authentication -> Users)
export const changePassword = () => 'Ganti password lewat dashboard Supabase (Authentication → Users) atau minta Pemilik meresetnya.'
export const addUser = () => 'Tambah akun lewat dashboard Supabase: Authentication → Users → Add user.'
export const removeUser = () => 'Hapus akun lewat dashboard Supabase: Authentication → Users.'
export const updateProfile = () => 'Profil dikelola dari akun Supabase.'
