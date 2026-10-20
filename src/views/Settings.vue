<script setup>
import Icon from '../components/Icon.vue'
import { reactive, ref } from 'vue'
import { store, resetDemo, toast, askConfirm } from '../store'
import { auth, user, isOwner, ROLES, changePassword, updateProfile, addUser, removeUser } from '../auth'
import { downloadFile } from '../utils'

const prof = reactive({ name: user.value.name, username: user.value.username, password: '' })
const profError = ref('')
function saveProfile() {
  profError.value = ''
  const err = updateProfile(prof)
  if (err) return (profError.value = err)
  prof.password = ''
  toast('Profil diperbarui. Gunakan username baru saat login berikutnya.')
}

const pw = reactive({ old: '', next: '', again: '' })
const pwError = ref('')
function savePw() {
  pwError.value = ''
  if (pw.next !== pw.again) return (pwError.value = 'Konfirmasi password tidak sama.')
  const err = changePassword(pw.old, pw.next)
  if (err) return (pwError.value = err)
  Object.assign(pw, { old: '', next: '', again: '' })
  toast('Password diperbarui')
}
const nu = reactive({ name: '', username: '', password: '', role: 'cashier' })
const nuError = ref('')
function createUser() {
  nuError.value = ''
  const err = addUser(nu)
  if (err) return (nuError.value = err)
  Object.assign(nu, { name: '', username: '', password: '', role: 'cashier' })
  toast('Pengguna ditambahkan')
}
async function delUser(u) {
  if (!(await askConfirm({ title: 'Hapus pengguna?', message: `Akun ${u.username} tidak akan bisa masuk lagi.` }))) return
  const err = removeUser(u.id)
  toast(err || 'Pengguna dihapus', err ? 'error' : 'success')
}

async function reset() {
  if (await askConfirm({ title: 'Reset ke data demo?', message: 'Semua data yang kamu input akan diganti dengan data contoh.', okText: 'Reset' })) {
    resetDemo()
    toast('Data demo dimuat ulang')
  }
}
async function clearAll() {
  if (await askConfirm({ title: 'Kosongkan semua data?', message: 'Transaksi, invoice, produk, dan kontak akan dihapus permanen. Mulai dari nol.', okText: 'Kosongkan' })) {
    store.transactions = []
    store.invoices = []
    store.products = []
    store.contacts = []
    toast('Semua data dikosongkan')
  }
}
function backup() {
  downloadFile('backup-erp.json', JSON.stringify(store, null, 2), 'application/json')
  toast('Backup diunduh')
}
function restore(e) {
  const file = e.target.files[0]
  if (!file) return
  const r = new FileReader()
  r.onload = () => {
    try {
      const d = JSON.parse(r.result)
      if (!d.transactions || !d.invoices) throw new Error()
      Object.assign(store, d)
      toast('Backup dipulihkan')
    } catch {
      toast('File backup tidak valid', 'error')
    }
  }
  r.readAsText(file)
  e.target.value = ''
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Pengaturan</h1><p>Atur profil usaha, tampilan, dan data aplikasi.</p></div>
    </div>

    <div class="grid cols-2" style="align-items: start">
      <div v-if="isOwner" class="card">
        <div class="card-head"><h3>Profil Usaha</h3></div>
        <div class="form-grid">
          <div class="field full"><label>Nama usaha</label><input v-model="store.settings.company" class="input" /></div>
          <div class="field"><label>Tarif PPN (%)</label><input v-model.number="store.settings.taxRate" type="number" min="0" max="100" class="input" /></div>
          <div class="field"><label>Saldo awal kas (Rp)</label><input v-model.number="store.settings.openingBalance" type="number" min="0" class="input" /></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Tampilan</h3></div>
        <div class="field">
          <label>Tema</label>
          <div class="segmented" style="width: 100%">
            <button style="flex: 1" :class="{ active: store.settings.theme === 'light' }" @click="store.settings.theme = 'light'"><Icon name="sun" :size="14" /> Terang</button>
            <button style="flex: 1" :class="{ active: store.settings.theme === 'dark' }" @click="store.settings.theme = 'dark'"><Icon name="moon" :size="14" /> Gelap</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Akun Saya</h3><div class="sub">Masuk sebagai {{ user.name }} ({{ user.username }})</div></div></div>
        <form class="form-grid" style="margin-bottom: 22px; padding-bottom: 22px; border-bottom: 1px solid var(--border)" @submit.prevent="saveProfile">
          <div class="field"><label>Nama tampilan</label><input v-model="prof.name" class="input" /></div>
          <div class="field"><label>Username (untuk login)</label><input v-model="prof.username" class="input" autocomplete="off" /></div>
          <div class="field full"><label>Password saat ini (konfirmasi)</label><input v-model="prof.password" type="password" class="input" autocomplete="current-password" /></div>
          <p v-if="profError" class="neg full" role="alert">{{ profError }}</p>
          <div class="full"><button class="btn primary">Simpan profil</button></div>
        </form>
        <form class="form-grid" @submit.prevent="savePw">
          <div class="field full"><label>Password lama</label><input v-model="pw.old" type="password" class="input" autocomplete="current-password" /></div>
          <div class="field"><label>Password baru</label><input v-model="pw.next" type="password" class="input" autocomplete="new-password" /></div>
          <div class="field"><label>Ulangi password baru</label><input v-model="pw.again" type="password" class="input" autocomplete="new-password" /></div>
          <p v-if="pwError" class="neg full" role="alert">{{ pwError }}</p>
          <div class="full"><button class="btn primary">Ganti password</button></div>
        </form>
      </div>

      <div v-if="isOwner" class="card">
        <div class="card-head"><div><h3>Pengguna</h3><div class="sub">Kasir tidak bisa membuka Laporan dan pengaturan usaha.</div></div></div>
        <div v-for="u in auth.users" :key="u.id" class="list-item">
          <div class="avatar">{{ u.name.slice(0, 2).toUpperCase() }}</div>
          <div style="flex: 1; min-width: 0"><strong style="display: block">{{ u.name }}</strong><small class="muted">{{ u.username }}</small></div>
          <span class="badge plain" :class="u.role === 'owner' ? 'primary' : ''">{{ ROLES[u.role] }}</span>
          <button class="icon-btn danger" aria-label="Hapus" :disabled="u.id === user.id" @click="delUser(u)"><Icon name="trash" :size="16" /></button>
        </div>
        <form class="form-grid" style="margin-top: 16px" @submit.prevent="createUser">
          <div class="field"><label>Nama</label><input v-model="nu.name" class="input" /></div>
          <div class="field"><label>Username</label><input v-model="nu.username" class="input" autocomplete="off" /></div>
          <div class="field"><label>Password</label><input v-model="nu.password" type="password" class="input" autocomplete="new-password" /></div>
          <div class="field"><label>Peran</label><select v-model="nu.role" class="select"><option value="cashier">Kasir</option><option value="owner">Pemilik</option></select></div>
          <p v-if="nuError" class="neg full" role="alert">{{ nuError }}</p>
          <div class="full"><button class="btn">Tambah pengguna</button></div>
        </form>
      </div>

      <div v-if="isOwner" class="card" style="grid-column: 1 / -1">
        <div class="card-head"><div><h3>Data</h3><div class="sub">Data tersimpan di browser ini (localStorage).</div></div></div>
        <div class="row wrap">
          <button class="btn" @click="backup"><Icon name="download" :size="16" />Backup JSON</button>
          <label class="btn" style="cursor: pointer"><Icon name="reset" :size="16" />Pulihkan backup<input type="file" accept="application/json" hidden @change="restore" /></label>
          <span class="spacer"></span>
          <button class="btn" @click="reset"><Icon name="reset" :size="16" />Reset data demo</button>
          <button class="btn danger" @click="clearAll"><Icon name="trash" :size="16" />Kosongkan semua</button>
        </div>
      </div>
    </div>
  </div>
</template>
