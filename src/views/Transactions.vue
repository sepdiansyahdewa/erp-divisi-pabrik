<script setup>
import { computed, reactive, ref } from 'vue'
import DataTable from '../components/DataTable.vue'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import ImportModal from '../components/ImportModal.vue'
import { store, save, remove, toast, askConfirm, ACCOUNTS, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../store'
import { downloadFile, fmtDate, rupiah, todayISO, toCSV } from '../utils'

const imp = ref(false)
const q = ref('')
const type = ref('all')
const category = ref('')
const allCategories = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

const rows = computed(() =>
  store.transactions.filter(
    (t) =>
      (type.value === 'all' || t.type === type.value) &&
      (!category.value || t.category === category.value) &&
      (!q.value || (t.description + t.category + t.account).toLowerCase().includes(q.value.toLowerCase())),
  ),
)
const sum = computed(() => {
  const income = rows.value.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = rows.value.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return { income, expense, net: income - expense }
})

const columns = [
  { key: 'description', label: 'Keterangan' },
  { key: 'category', label: 'Kategori' },
  { key: 'account', label: 'Akun' },
  { key: 'date', label: 'Tanggal' },
  { key: 'amount', label: 'Jumlah', align: 'right', sortValue: (r) => (r.type === 'income' ? r.amount : -r.amount) },
]

const open = ref(false)
const empty = () => ({ type: 'expense', date: todayISO(), amount: null, category: EXPENSE_CATEGORIES[0], account: ACCOUNTS[0], description: '' })
const form = reactive(empty())
const cats = computed(() => (form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES))

function add() {
  Object.assign(form, empty(), { id: undefined })
  open.value = true
}
function edit(t) {
  Object.assign(form, t)
  open.value = true
}
function setType(t) {
  form.type = t
  if (!cats.value.includes(form.category)) form.category = cats.value[0]
}
function submit() {
  if (!form.description.trim() || !form.amount || form.amount <= 0) return toast('Isi keterangan dan jumlah dengan benar', 'error')
  const isNew = !form.id
  save('transactions', { ...form, amount: Number(form.amount) })
  open.value = false
  toast(isNew ? 'Transaksi ditambahkan' : 'Transaksi diperbarui')
}
async function del(t) {
  if (await askConfirm({ title: 'Hapus transaksi?', message: `"${t.description}" sebesar ${rupiah(t.amount)} akan dihapus permanen.` })) {
    remove('transactions', t.id)
    toast('Transaksi dihapus')
  }
}
function exportCSV() {
  downloadFile(
    'transaksi.csv',
    toCSV([['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Akun', 'Jumlah'], ...rows.value.map((t) => [t.date, t.type, t.category, t.description, t.account, t.amount])]),
  )
  toast('CSV berhasil diunduh')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Transaksi</h1>
        <p>Catat dan pantau semua pemasukan serta pengeluaran.</p>
      </div>
      <div class="row">
        <button class="btn" @click="exportCSV"><Icon name="download" :size="16" />Ekspor CSV</button>
        <button class="btn" @click="imp = true"><Icon name="upload" :size="16" />Impor Excel</button>
        <button class="btn primary" @click="add"><Icon name="plus" :size="16" />Tambah transaksi</button>
      </div>
    </div>

    <div class="grid cols-3" style="margin-bottom: 18px">
      <div class="card"><div class="muted">Pemasukan</div><div class="big pos num">{{ rupiah(sum.income) }}</div></div>
      <div class="card"><div class="muted">Pengeluaran</div><div class="big neg num">{{ rupiah(sum.expense) }}</div></div>
      <div class="card"><div class="muted">Selisih</div><div class="big num" :class="sum.net >= 0 ? 'pos' : 'neg'">{{ rupiah(sum.net) }}</div></div>
    </div>

    <div class="card flush">
      <div class="row wrap" style="padding: 16px 18px">
        <div class="search">
          <Icon name="search" :size="16" />
          <input v-model="q" class="input" placeholder="Cari transaksi…" />
        </div>
        <div class="segmented">
          <button v-for="o in [['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran']]" :key="o[0]" :class="{ active: type === o[0] }" @click="type = o[0]">{{ o[1] }}</button>
        </div>
        <select v-model="category" class="select" style="width: 180px">
          <option value="">Semua kategori</option>
          <option v-for="c in allCategories" :key="c">{{ c }}</option>
        </select>
      </div>

      <DataTable :columns="columns" :rows="rows" :page-size="9" empty-text="Transaksi tidak ditemukan">
        <template #cell-description="{ row }">
          <div class="cell-main">
            <div class="avatar" :class="row.type"><Icon :name="row.type === 'income' ? 'up' : 'down'" :size="16" /></div>
            <strong>{{ row.description }}</strong>
          </div>
        </template>
        <template #cell-category="{ value }"><span class="badge plain">{{ value }}</span></template>
        <template #cell-date="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-amount="{ row }">
          <b class="num" :class="row.type === 'income' ? 'pos' : 'neg'">{{ row.type === 'income' ? '+' : '−' }}{{ rupiah(row.amount) }}</b>
        </template>
        <template #actions="{ row }">
          <button class="icon-btn" aria-label="Edit" @click="edit(row)"><Icon name="edit" :size="16" /></button>
          <button class="icon-btn danger" aria-label="Hapus" @click="del(row)"><Icon name="trash" :size="16" /></button>
        </template>
      </DataTable>
    </div>

    <ImportModal v-model="imp" type="transactions" lock />

    <Modal v-model="open" :title="form.id ? 'Edit transaksi' : 'Transaksi baru'">
      <form class="form-grid" @submit.prevent="submit" id="trx-form">
        <div class="field full">
          <label>Jenis</label>
          <div class="segmented" style="width: 100%">
            <button type="button" style="flex: 1" :class="{ active: form.type === 'income' }" @click="setType('income')">Pemasukan</button>
            <button type="button" style="flex: 1" :class="{ active: form.type === 'expense' }" @click="setType('expense')">Pengeluaran</button>
          </div>
        </div>
        <div class="field full">
          <label>Keterangan</label>
          <input v-model="form.description" class="input" placeholder="Mis. Pembelian stok barang" autofocus />
        </div>
        <div class="field">
          <label>Jumlah (Rp)</label>
          <input v-model.number="form.amount" type="number" min="0" step="1000" class="input" placeholder="0" />
        </div>
        <div class="field">
          <label>Tanggal</label>
          <input v-model="form.date" type="date" class="input" />
        </div>
        <div class="field">
          <label>Kategori</label>
          <select v-model="form.category" class="select"><option v-for="c in cats" :key="c">{{ c }}</option></select>
        </div>
        <div class="field">
          <label>Akun</label>
          <select v-model="form.account" class="select"><option v-for="a in ACCOUNTS" :key="a">{{ a }}</option></select>
        </div>
      </form>
      <template #footer>
        <button class="btn" @click="open = false">Batal</button>
        <button class="btn primary" type="submit" form="trx-form">Simpan</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.big {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 2px;
}
</style>
