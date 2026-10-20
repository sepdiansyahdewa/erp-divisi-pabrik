<script setup>
import { computed, reactive, ref } from 'vue'
import DataTable from '../components/DataTable.vue'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import ImportModal from '../components/ImportModal.vue'
import { store, save, remove, toast, askConfirm, invoiceTotal, invoiceStatus } from '../store'
import { initials, rupiah } from '../utils'

const tab = ref('customer')
const imp = ref(false)
const q = ref('')
const rows = computed(() =>
  store.contacts
    .filter((c) => c.type === tab.value && (!q.value || (c.name + c.city + c.email).toLowerCase().includes(q.value.toLowerCase())))
    .map((c) => {
      const inv = store.invoices.filter((i) => i.contactId === c.id)
      return {
        ...c,
        invoices: inv.length,
        outstanding: inv.filter((i) => ['sent', 'overdue'].includes(invoiceStatus(i))).reduce((s, i) => s + invoiceTotal(i), 0),
      }
    }),
)
const count = (t) => store.contacts.filter((c) => c.type === t).length

const columns = computed(() => [
  { key: 'name', label: 'Nama' },
  { key: 'phone', label: 'Kontak', sortable: false },
  { key: 'city', label: 'Kota' },
  ...(tab.value === 'customer'
    ? [
        { key: 'invoices', label: 'Invoice', align: 'right' },
        { key: 'outstanding', label: 'Piutang', align: 'right' },
      ]
    : []),
])

const open = ref(false)
const blank = () => ({ name: '', type: tab.value, email: '', phone: '', city: '' })
const form = reactive(blank())
const add = () => {
  Object.assign(form, blank(), { id: undefined })
  open.value = true
}
const edit = (c) => {
  Object.assign(form, c)
  open.value = true
}
function submit() {
  if (!form.name.trim()) return toast('Nama wajib diisi', 'error')
  const isNew = !form.id
  const { invoices, outstanding, ...clean } = form
  save('contacts', clean)
  open.value = false
  toast(isNew ? 'Kontak ditambahkan' : 'Kontak diperbarui')
}
async function del(c) {
  if (store.invoices.some((i) => i.contactId === c.id)) return toast('Tidak bisa dihapus: masih punya invoice', 'error')
  if (await askConfirm({ title: 'Hapus kontak?', message: `${c.name} akan dihapus.` })) {
    remove('contacts', c.id)
    toast('Kontak dihapus')
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Pelanggan & Vendor</h1>
        <p>Kelola relasi bisnis dan lihat piutang tiap pelanggan.</p>
      </div>
      <button class="btn" @click="imp = true"><Icon name="upload" :size="16" />Impor Excel</button>
        <button class="btn primary" @click="add"><Icon name="plus" :size="16" />Tambah {{ tab === 'customer' ? 'pelanggan' : 'vendor' }}</button>
    </div>

    <div class="card flush">
      <div class="row wrap" style="padding: 16px 18px">
        <div class="search"><Icon name="search" :size="16" /><input v-model="q" class="input" placeholder="Cari nama / kota…" /></div>
        <div class="segmented">
          <button :class="{ active: tab === 'customer' }" @click="tab = 'customer'">Pelanggan <span class="muted">{{ count('customer') }}</span></button>
          <button :class="{ active: tab === 'vendor' }" @click="tab = 'vendor'">Vendor <span class="muted">{{ count('vendor') }}</span></button>
        </div>
      </div>
      <DataTable :columns="columns" :rows="rows" :page-size="8" empty-text="Kontak tidak ditemukan">
        <template #cell-name="{ row }">
          <div class="cell-main">
            <div class="avatar">{{ initials(row.name) }}</div>
            <div><strong>{{ row.name }}</strong><small>{{ row.email }}</small></div>
          </div>
        </template>
        <template #cell-phone="{ value }"><span class="row" style="gap: 6px"><Icon name="phone" :size="14" />{{ value }}</span></template>
        <template #cell-outstanding="{ value }"><b class="num" :class="{ neg: value > 0, muted: !value }">{{ value ? rupiah(value) : '—' }}</b></template>
        <template #actions="{ row }">
          <button class="icon-btn" aria-label="Edit" @click="edit(row)"><Icon name="edit" :size="16" /></button>
          <button class="icon-btn danger" aria-label="Hapus" @click="del(row)"><Icon name="trash" :size="16" /></button>
        </template>
      </DataTable>
    </div>

    <ImportModal v-model="imp" type="contacts" lock />

    <Modal v-model="open" :title="form.id ? 'Edit kontak' : 'Kontak baru'">
      <form id="contact-form" class="form-grid" @submit.prevent="submit">
        <div class="field full">
          <label>Tipe</label>
          <div class="segmented" style="width: 100%">
            <button type="button" style="flex: 1" :class="{ active: form.type === 'customer' }" @click="form.type = 'customer'">Pelanggan</button>
            <button type="button" style="flex: 1" :class="{ active: form.type === 'vendor' }" @click="form.type = 'vendor'">Vendor</button>
          </div>
        </div>
        <div class="field full"><label>Nama</label><input v-model="form.name" class="input" placeholder="PT / CV / nama perorangan" /></div>
        <div class="field"><label>Email</label><input v-model="form.email" type="email" class="input" /></div>
        <div class="field"><label>Telepon</label><input v-model="form.phone" class="input" /></div>
        <div class="field full"><label>Kota</label><input v-model="form.city" class="input" /></div>
      </form>
      <template #footer>
        <button class="btn" @click="open = false">Batal</button>
        <button class="btn primary" type="submit" form="contact-form">Simpan</button>
      </template>
    </Modal>
  </div>
</template>
