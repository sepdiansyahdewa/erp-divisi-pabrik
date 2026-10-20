<script setup>
import { computed, reactive, ref } from 'vue'
import DataTable from '../components/DataTable.vue'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import InvoiceBadge from '../components/InvoiceBadge.vue'
import {
  store, save, remove, toast, askConfirm, ACCOUNTS, contactName, invoiceTotal, invoiceSubtotal, invoiceTax,
  invoiceStatus, markInvoicePaid, nextInvoiceNumber,
} from '../store'
import { addDays, fmtDate, rupiah, todayISO } from '../utils'

const tab = ref('all')
const q = ref('')
const tabs = [
  ['all', 'Semua'],
  ['draft', 'Draft'],
  ['sent', 'Terkirim'],
  ['overdue', 'Jatuh tempo'],
  ['paid', 'Lunas'],
]
const count = (k) => (k === 'all' ? store.invoices.length : store.invoices.filter((i) => invoiceStatus(i) === k).length)

const rows = computed(() =>
  store.invoices
    .filter((i) => (tab.value === 'all' || invoiceStatus(i) === tab.value) && (!q.value || (i.number + contactName(i.contactId)).toLowerCase().includes(q.value.toLowerCase())))
    .map((i) => ({ ...i, customer: contactName(i.contactId), total: invoiceTotal(i) })),
)
const columns = [
  { key: 'number', label: 'No. Invoice' },
  { key: 'customer', label: 'Pelanggan' },
  { key: 'issueDate', label: 'Terbit' },
  { key: 'dueDate', label: 'Jatuh tempo' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status', sortValue: (r) => invoiceStatus(r) },
]

const summary = computed(() => {
  const by = (k) => store.invoices.filter((i) => invoiceStatus(i) === k).reduce((s, i) => s + invoiceTotal(i), 0)
  return { outstanding: by('sent'), overdue: by('overdue'), paid: by('paid') }
})

/* ---- form ---- */
const open = ref(false)
const blank = () => ({
  number: nextInvoiceNumber(), contactId: store.contacts.find((c) => c.type === 'customer')?.id,
  issueDate: todayISO(), dueDate: addDays(todayISO(), 30), status: 'sent', tax: true,
  items: [{ name: '', qty: 1, price: 0 }],
})
const form = reactive(blank())
const customers = computed(() => store.contacts.filter((c) => c.type === 'customer'))
const live = computed(() => ({ subtotal: invoiceSubtotal(form), tax: invoiceTax(form), total: invoiceTotal(form) }))

function add() {
  Object.assign(form, blank(), { id: undefined })
  open.value = true
}
function edit(i) {
  Object.assign(form, JSON.parse(JSON.stringify(i)))
  open.value = true
}
function fillPrice(item) {
  const p = store.products.find((p) => p.name === item.name)
  if (p) item.price = p.price
}
function submit() {
  if (!form.items.some((i) => i.name.trim() && i.qty > 0)) return toast('Tambahkan minimal satu item', 'error')
  const items = form.items.filter((i) => i.name.trim())
  const isNew = !form.id
  save('invoices', { ...JSON.parse(JSON.stringify(form)), items })
  open.value = false
  toast(isNew ? 'Invoice dibuat' : 'Invoice diperbarui')
}
async function del(i) {
  if (await askConfirm({ title: 'Hapus invoice?', message: `${i.number} akan dihapus permanen.` })) {
    remove('invoices', i.id)
    detail.value = null
    toast('Invoice dihapus')
  }
}

/* ---- detail ---- */
const detailId = ref(null)
const detail = computed({
  get: () => store.invoices.find((i) => i.id === detailId.value) || null,
  set: (v) => (detailId.value = v?.id ?? null),
})
const printPage = () => window.print()
const account = ref(ACCOUNTS[1])
function pay() {
  markInvoicePaid(detail.value, account.value)
  toast('Invoice lunas & dicatat sebagai pemasukan')
}
function send() {
  detail.value.status = 'sent'
  toast('Invoice ditandai terkirim')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Invoice</h1>
        <p>Buat tagihan, pantau pembayaran, dan catat otomatis ke kas.</p>
      </div>
      <button class="btn primary" @click="add"><Icon name="plus" :size="16" />Invoice baru</button>
    </div>

    <div class="grid cols-3" style="margin-bottom: 18px">
      <div class="card hover"><div class="muted">Menunggu pembayaran</div><div class="big num" style="color: var(--info)">{{ rupiah(summary.outstanding) }}</div></div>
      <div class="card hover"><div class="muted">Lewat jatuh tempo</div><div class="big num neg">{{ rupiah(summary.overdue) }}</div></div>
      <div class="card hover"><div class="muted">Sudah dibayar</div><div class="big num pos">{{ rupiah(summary.paid) }}</div></div>
    </div>

    <div class="card flush">
      <div class="row wrap" style="padding: 16px 18px">
        <div class="search">
          <Icon name="search" :size="16" />
          <input v-model="q" class="input" placeholder="Cari nomor / pelanggan…" />
        </div>
        <div class="segmented">
          <button v-for="t in tabs" :key="t[0]" :class="{ active: tab === t[0] }" @click="tab = t[0]">{{ t[1] }} <span class="muted">{{ count(t[0]) }}</span></button>
        </div>
      </div>
      <DataTable :columns="columns" :rows="rows" :page-size="8" empty-text="Invoice tidak ditemukan">
        <template #cell-number="{ row }"><button class="link" @click="detail = row">{{ row.number }}</button></template>
        <template #cell-customer="{ row }">
          <div class="cell-main"><div class="avatar" style="width: 32px; height: 32px; font-size: 11px">{{ row.customer.replace(/^(PT|CV|UD|Toko)\s+/i, '').slice(0, 2).toUpperCase() }}</div><strong>{{ row.customer }}</strong></div>
        </template>
        <template #cell-issueDate="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-dueDate="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-total="{ value }"><b class="num">{{ rupiah(value) }}</b></template>
        <template #cell-status="{ row }"><InvoiceBadge :invoice="row" /></template>
        <template #actions="{ row }">
          <button class="icon-btn" aria-label="Lihat" @click="detail = row"><Icon name="invoice" :size="16" /></button>
          <button v-if="row.status !== 'paid'" class="icon-btn" aria-label="Edit" @click="edit(row)"><Icon name="edit" :size="16" /></button>
          <button class="icon-btn danger" aria-label="Hapus" @click="del(row)"><Icon name="trash" :size="16" /></button>
        </template>
      </DataTable>
    </div>

    <!-- form -->
    <Modal v-model="open" :title="form.id ? 'Edit invoice' : 'Invoice baru'" width="680px">
      <form id="inv-form" @submit.prevent="submit">
        <div class="form-grid">
          <div class="field"><label>No. Invoice</label><input v-model="form.number" class="input" /></div>
          <div class="field">
            <label>Pelanggan</label>
            <select v-model="form.contactId" class="select"><option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          </div>
          <div class="field"><label>Tanggal terbit</label><input v-model="form.issueDate" type="date" class="input" /></div>
          <div class="field"><label>Jatuh tempo</label><input v-model="form.dueDate" type="date" class="input" /></div>
        </div>

        <div class="items-editor" style="margin-top: 20px">
          <div class="row" style="margin-bottom: 8px"><strong>Item</strong><span class="spacer"></span><button type="button" class="btn sm" @click="form.items.push({ name: '', qty: 1, price: 0 })"><Icon name="plus" :size="14" />Tambah item</button></div>
          <div v-for="(it, idx) in form.items" :key="idx" class="item-row">
            <input v-model="it.name" class="input" list="product-list" placeholder="Nama item / jasa" @change="fillPrice(it)" />
            <input v-model.number="it.qty" type="number" min="1" class="input" aria-label="Jumlah" />
            <input v-model.number="it.price" type="number" min="0" class="input" aria-label="Harga" />
            <button type="button" class="icon-btn danger" :disabled="form.items.length === 1" aria-label="Hapus item" @click="form.items.splice(idx, 1)"><Icon name="x" :size="16" /></button>
          </div>
          <datalist id="product-list"><option v-for="p in store.products" :key="p.id" :value="p.name" /></datalist>
        </div>

        <div class="row wrap" style="margin-top: 14px; align-items: flex-start">
          <div class="field" style="flex: 1; min-width: 200px">
            <label class="row" style="gap: 8px; cursor: pointer; font-size: 13.5px; color: var(--text)"><input v-model="form.tax" type="checkbox" />Kenakan PPN {{ store.settings.taxRate }}%</label>
            <label class="row" style="gap: 8px; cursor: pointer; font-size: 13.5px; color: var(--text)"><input v-model="form.status" type="checkbox" true-value="draft" false-value="sent" />Simpan sebagai draft</label>
          </div>
          <div style="min-width: 240px; flex: 1">
            <div class="kv"><span class="muted">Subtotal</span><span class="num">{{ rupiah(live.subtotal) }}</span></div>
            <div class="kv"><span class="muted">PPN</span><span class="num">{{ rupiah(live.tax) }}</span></div>
            <div class="kv total"><span>Total</span><span class="num">{{ rupiah(live.total) }}</span></div>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn" @click="open = false">Batal</button>
        <button class="btn primary" type="submit" form="inv-form">Simpan invoice</button>
      </template>
    </Modal>

    <!-- detail -->
    <Modal :model-value="!!detail" :title="detail?.number" width="640px" @update:model-value="detail = null">
      <template v-if="detail">
        <div class="row" style="align-items: flex-start; margin-bottom: 20px">
          <div>
            <div class="muted">Ditagihkan kepada</div>
            <strong style="font-size: 16px">{{ contactName(detail.contactId) }}</strong>
            <div class="muted">Terbit {{ fmtDate(detail.issueDate) }} · Jatuh tempo {{ fmtDate(detail.dueDate) }}</div>
          </div>
          <span class="spacer"></span>
          <InvoiceBadge :invoice="detail" />
        </div>
        <table class="table" style="border: 1px solid var(--border); border-radius: 10px; overflow: hidden">
          <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead>
          <tbody>
            <tr v-for="(it, i) in detail.items" :key="i"><td>{{ it.name }}</td><td class="right num">{{ it.qty }}</td><td class="right num">{{ rupiah(it.price) }}</td><td class="right num">{{ rupiah(it.qty * it.price) }}</td></tr>
          </tbody>
        </table>
        <div style="margin-left: auto; max-width: 260px; margin-top: 12px">
          <div class="kv"><span class="muted">Subtotal</span><span class="num">{{ rupiah(invoiceSubtotal(detail)) }}</span></div>
          <div class="kv"><span class="muted">PPN {{ detail.tax ? store.settings.taxRate + '%' : '' }}</span><span class="num">{{ rupiah(invoiceTax(detail)) }}</span></div>
          <div class="kv total"><span>Total</span><span class="num">{{ rupiah(invoiceTotal(detail)) }}</span></div>
        </div>
        <p v-if="detail.status === 'paid'" class="muted" style="margin-top: 14px">Dibayar pada {{ fmtDate(detail.paidDate) }}.</p>
      </template>
      <template #footer>
        <button class="btn" @click="printPage"><Icon name="print" :size="16" />Cetak</button>
        <template v-if="detail && detail.status !== 'paid'">
          <button v-if="detail.status === 'draft'" class="btn" @click="send">Tandai terkirim</button>
          <select v-model="account" class="select" style="width: 140px"><option v-for="a in ACCOUNTS" :key="a">{{ a }}</option></select>
          <button class="btn primary" @click="pay"><Icon name="check" :size="16" />Tandai lunas</button>
        </template>
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
